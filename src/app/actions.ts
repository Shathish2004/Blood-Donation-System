

'use server';

import {
  estimateBloodExpirationDate,
  EstimateBloodExpirationDateInput,
  EstimateBloodExpirationDateOutput,
} from '@/ai/flows/blood-expiration-date-estimation';
import {
  matchInventoryToRequests,
  MatchInventoryToRequestsInput,
  MatchInventoryToRequestsOutput,
} from '@/ai/flows/inventory-request-matching';
import {
  matchBloodReports,
  MatchBloodReportsInput,
  MatchBloodReportsOutput,
} from '@/ai/flows/blood-report-matching';
import {
  forecastDemand,
  DemandForecastInput,
  DemandForecastOutput,
} from '@/ai/flows/demand-forecasting';
import clientPromise from '@/lib/mongodb';
import type {BloodRequest, Notification, Urgency, Donation, BloodUnit, Transfer, BloodOffer, DonationType, BloodType} from '@/lib/types';
import type {WithId, Document, ObjectId} from 'mongodb';
import { addDays, subDays } from 'date-fns';

export type User = {
  _id?: string; // Changed to string to be serializable
  email: string;
  password?: string;
  role: 'Donor' | 'Individual' | 'Hospital' | 'Blood Bank' | 'Admin';
  name?: string;
  address?: string;
  bloodType?: string;
  mobileNumber?: string;
  city?: string;
  state?: string;
  country?: string;
  licenseNo?: string;
  location?: string;
  availableBloodTypes?: string[];
  inventorySummary?: {
    whole_blood: number;
    plasma: number;
    red_blood_cells: number;
  };
  status?: 'active' | 'banned';
};

type DbUser = Omit<User, '_id'> & { _id: ObjectId };


// Helper function to get the database and a collection
async function getCollection(collectionName: string) {
  const client = await clientPromise;
  const db = client.db("blood_net");
  return db.collection(collectionName);
}

// Helper to serialize an object with ObjectId
function serializeObject<T extends Document>(doc: WithId<T>): T & { _id: string } {
    const { _id, ...rest } = doc;
    return { ...rest, _id: _id.toHexString() } as unknown as T & { _id: string };
}

export const saveUser = async (user: Omit<User, '_id'>): Promise<User> => {
    const users = await getCollection('users');
    const result = await users.insertOne({...user, status: 'active'});
    const newUser = await users.findOne({_id: result.insertedId}) as WithId<DbUser> | null;
    if (!newUser) {
        throw new Error("Failed to create user");
    }
    return serializeObject(newUser);
};

export const getUser = async (email: string): Promise<User | null> => {
  if (email === 'admin@bloodnet.com') {
    return {
      _id: 'admin',
      email: 'admin@bloodnet.com',
      role: 'Admin',
      name: 'Administrator',
      status: 'active',
    }
  }
  const users = await getCollection('users');
  const user = await users.findOne({ email }) as WithId<DbUser> | null;
  return user ? serializeObject(user) : null;
};

export const updateUser = async (
  email: string,
  newData: Partial<User>
): Promise<User> => {
    const users = await getCollection('users');
    await users.updateOne({ email }, { $set: newData });
    const updatedUser = await users.findOne({ email }) as WithId<DbUser> | null;
    if (!updatedUser) {
        throw new Error('User not found after update.');
    }
    return serializeObject(updatedUser);
};

// --- Admin Actions ---

export async function getAllUsers(): Promise<User[]> {
  const usersCollection = await getCollection('users');
  const users = await usersCollection.find({ role: { $ne: 'Admin' } }).toArray() as WithId<DbUser>[];
  return users.map(u => serializeObject(u));
}

export async function deleteUser(email: string): Promise<{ deletedCount?: number }> {
    if (email === 'admin@bloodnet.com') {
        throw new Error('Cannot delete admin user.');
    }
    const users = await getCollection('users');
    const result = await users.deleteOne({ email });
    return { deletedCount: result.deletedCount };
}

export async function updateUserStatus(email: string, status: 'active' | 'banned'): Promise<User> {
    return updateUser(email, { status });
}

export async function getSystemStats() {
    const users = await getCollection('users');
    const inventory = await getCollection('blood_units');
    const requests = await getCollection('blood_requests');
    const transfers = await getCollection('transfers');

    const totalUsers = await users.countDocuments({ role: { $ne: 'Admin' } });
    const totalUnitsResult = await inventory.aggregate([{ $group: { _id: null, total: { $sum: '$units' } } }]).toArray();
    const totalUnits = totalUnitsResult[0]?.total || 0;
    const openRequests = await requests.countDocuments({ status: 'Pending' });
    const totalTransfers = await transfers.countDocuments();
    
    return { totalUsers, totalUnits, openRequests, totalTransfers };
}

export async function getDemandForecast(input: DemandForecastInput): Promise<DemandForecastOutput> {
    return await forecastDemand(input);
}

export async function getHistoricalDataForForecast(): Promise<{requests: BloodRequest[], inventory: BloodUnit[]}> {
    const requestsCollection = await getCollection('blood_requests');
    const inventoryCollection = await getCollection('blood_units');
    const requestData = await requestsCollection.find({}).sort({ date: -1 }).limit(500).toArray() as WithId<BloodRequest>[];
    const inventoryData = await inventoryCollection.find({}).sort({ collectionDate: -1 }).limit(500).toArray() as WithId<BloodUnit>[];
    
    return { 
        requests: requestData.map(r => serializeObject(r)), 
        inventory: inventoryData.map(i => serializeObject(i)) 
    };
}


// --- AI Actions ---

export async function estimateExpiration(
  input: EstimateBloodExpirationDateInput
): Promise<EstimateBloodExpirationDateOutput> {
  return await estimateBloodExpirationDate(input);
}

export async function findInventoryMatches(
  input: MatchInventoryToRequestsInput
): Promise<MatchInventoryToRequestsOutput> {
  return await matchInventoryToRequests(input);
}

export async function findBloodReportMatch(
  input: MatchBloodReportsInput
): Promise<MatchBloodReportsOutput> {
  return await matchBloodReports(input);
}

// --- User Actions ---

export async function updateUserData(email: string, data: any) {
    return updateUser(email, data);
}

export async function createBloodRequest(request: {
  requester: string;
  bloodType: string;
  donationType: DonationType;
  units: number;
  urgency: Urgency;
  emergency?: boolean;
}) {
  const requests = await getCollection('blood_requests');
  const notifications = await getCollection('notifications');
  
  const requesterData = await getUser(request.requester);
  if (!requesterData) throw new Error("Requester not found.");

  // 1. Create the blood request
  const newRequestData = {
    date: new Date().toISOString(),
    status: 'Pending' as const,
    ...request,
  };
  const result = await requests.insertOne(newRequestData);
  const newRequest = await requests.findOne({ _id: result.insertedId }) as WithId<BloodRequest> | null;
  
  if (!newRequest) throw new Error("Failed to create request.");

  // 2. Find potential responders (donors, hospitals, blood banks)
  const potentialResponders = await getPotentialDonors();
  const responders = potentialResponders.filter(
    user => (user.role === 'Donor' || user.role === 'Hospital' || user.role === 'Blood Bank') && user.email !== request.requester
  );

  // 3. Create a notification for each responder
  const notificationPromises = responders.map(responder => {
    
    const notification: Omit<Notification, '_id'> = {
        type: 'request',
        requestId: newRequest._id.toHexString(),
        recipientEmail: responder.email,
        requesterEmail: requesterData.email,
        requesterName: requesterData.name!,
        requesterMobileNumber: requesterData.mobileNumber,
        message: `${requesterData.name} has requested ${request.units} unit(s) of ${request.bloodType} ${request.donationType.replace('_', ' ')}.`,
        bloodType: request.bloodType,
        units: request.units,
        urgency: request.urgency,
        date: new Date().toISOString(),
        read: false,
    };
    return notifications.insertOne(notification);
  });

  await Promise.all(notificationPromises);

  return serializeObject(newRequest);
}


export async function createDirectBloodRequest(request: {
  requester: User;
  recipient: User;
  bloodType: string;
  donationType: DonationType;
  units: number;
  urgency: Urgency;
}) {
  const notifications = await getCollection('notifications');
  const newNotification: Omit<Notification, '_id'> = {
      type: 'request',
      recipientEmail: request.recipient.email,
      requesterEmail: request.requester.email,
      requesterName: request.requester.name!,
      requesterMobileNumber: request.requester.mobileNumber,
      message: `${request.requester.name} has sent you a direct request for ${request.units} unit(s) of ${request.bloodType} ${request.donationType.replace('_', ' ')}.`,
      bloodType: request.bloodType,
      units: request.units,
      urgency: request.urgency,
      date: new Date().toISOString(),
      read: false,
      requestId: `req${Date.now()}`, // This should be a real request ID
  };
  await notifications.insertOne(newNotification);
  return Promise.resolve({ success: true, message: `Request sent to ${request.recipient.name}` });
}

export async function createEmergencyPoll(requester: User, message: string) {
    const users = await getAllUsers();
    const notifications = await getCollection('notifications');
    const newRequest = await createBloodRequest({
        requester: requester.email!,
        bloodType: 'N/A' as BloodType,
        donationType: 'whole_blood',
        units: 0,
        urgency: 'Critical',
        emergency: true,
    });
    
    const notificationPromises = users.map(user => {
        if (user.email !== requester.email) {
            const notification: Omit<Notification, '_id'> = {
                type: 'emergency',
                recipientEmail: user.email,
                requesterEmail: requester.email!,
                requesterName: requester.name,
                message,
                bloodType: 'N/A',
                units: 0,
                urgency: 'Critical',
                date: new Date().toISOString(),
                read: false,
                requestId: newRequest._id
            };
            return notifications.insertOne(notification);
        }
        return null;
    }).filter(p => p !== null);

    await Promise.all(notificationPromises);
    return { success: true, message: 'Emergency broadcast sent to all users.' };
}

export async function getBloodRequestsForUser(
  email: string
): Promise<BloodRequest[]> {
  const requestsCollection = await getCollection('blood_requests');
  const requests = await requestsCollection.find({ requester: email }).sort({ date: -1 }).toArray() as WithId<BloodRequest>[];
  return requests.map(r => serializeObject(r));
}

export async function cancelBloodRequest(
  requestId: string
): Promise<{deletedCount?: number}> {
  const { ObjectId } = await import('mongodb');
  if (!ObjectId.isValid(requestId)) return { deletedCount: 0 };
  
  const requests = await getCollection('blood_requests');
  const result = await requests.deleteOne({ _id: new ObjectId(requestId) });
  
  // Also delete associated notifications
  const notifications = await getCollection('notifications');
  await notifications.deleteMany({ requestId });
  
  return { deletedCount: result.deletedCount };
}

export async function getPotentialDonors(): Promise<User[]> {
    const usersCollection = await getCollection('users');
    const donors = await usersCollection.find({ role: { $ne: 'Admin' } }).toArray() as WithId<DbUser>[];
    return donors.map(d => serializeObject(d));
}

export async function getNotificationsForUser(email: string): Promise<Notification[]> {
  const notificationsCollection = await getCollection('notifications');
  const notifications = await notificationsCollection.find({ recipientEmail: email }).sort({ date: -1 }).toArray() as WithId<Notification>[];
  return notifications.map(n => serializeObject(n));
}

export async function markNotificationAsRead(notificationId: string) {
  const { ObjectId } = await import('mongodb');
  if (!ObjectId.isValid(notificationId)) return { success: false };
  const notifications = await getCollection('notifications');
  await notifications.updateOne({ _id: new ObjectId(notificationId) }, { $set: { read: true } });
  return Promise.resolve({ success: true });
}

export async function respondToRequest(notificationId: string, requestId: string, responder: User, requesterEmail: string) {
    const notifications = await getCollection('notifications');
    const requests = await getCollection('blood_requests');
    const { ObjectId } = await import('mongodb');

    // 1. Update the original blood request to 'In Progress'
    if (!ObjectId.isValid(requestId)) throw new Error("Invalid request ID");
    const requestObjectId = new ObjectId(requestId);
    await requests.updateOne({ _id: requestObjectId }, { $set: { status: 'In Progress', responder: responder.email }});
    const request = await requests.findOne({ _id: requestObjectId }) as WithId<BloodRequest> | null;

    // 2. Delete all pending 'request' notifications for this requestId
    await notifications.deleteMany({ requestId: requestId, type: 'request' });

    // 3. Create a new 'response' notification for the original requester
    const responseNotification: Omit<Notification, '_id'> = {
        type: 'response',
        requestId: requestId,
        recipientEmail: requesterEmail,
        requesterEmail: responder.email!,
        requesterName: responder.name,
        requesterMobileNumber: responder.mobileNumber,
        date: new Date().toISOString(),
        read: false,
        message: `${responder.name} (${responder.role}) has accepted your blood request.`,
        bloodType: request?.bloodType || 'N/A',
        units: request?.units || 0,
        urgency: request?.urgency || 'Medium'
    };
    await notifications.insertOne(responseNotification);

    return Promise.resolve({ success: true, message: 'Response sent and request status updated.' });
}

export async function declineRequest(notificationId: string, requestId: string, responder: User, requesterEmail: string, reason: string) {
    const notifications = await getCollection('notifications');
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(notificationId)) throw new Error("Invalid notification ID");
    
    // Delete the specific request notification for the user who declined
    await notifications.deleteOne({ _id: new ObjectId(notificationId) });

    // Create a new 'decline' notification for the requester
    const declineNotification: Omit<Notification, '_id'> = {
        type: 'decline',
        requestId: requestId,
        recipientEmail: requesterEmail,
        requesterEmail: responder.email!,
        requesterName: responder.name,
        date: new Date().toISOString(),
        read: false,
        message: `${responder.name} (${responder.role}) has declined your request. Reason: ${reason}`,
        bloodType: 'N/A', units: 0, urgency: 'Low',
    };
    await notifications.insertOne(declineNotification);

    return Promise.resolve({ success: true, message: 'Decline notification sent.' });
}

export async function getDonationHistory(donorEmail: string): Promise<Donation[]> {
  const historyCollection = await getCollection('donation_history');
  const history = await historyCollection.find({ donorEmail }).sort({ date: -1 }).toArray() as WithId<Donation>[];
  return history.map(d => serializeObject(d));
}

export async function addDonationHistory(donation: Omit<Donation, '_id'>): Promise<Donation> {
    const history = await getCollection('donation_history');
    const result = await history.insertOne(donation);
    const newDonation = await history.findOne({ _id: result.insertedId }) as WithId<Donation> | null;
    if (!newDonation) throw new Error("Failed to add donation record.");
    return serializeObject(newDonation);
}

export async function updateDonationHistory(donationId: string, donationData: Partial<Omit<Donation, '_id'>>): Promise<Donation> {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(donationId)) {
        throw new Error('Invalid donation ID format.');
    }
    const history = await getCollection('donation_history');
    const objectId = new ObjectId(donationId);
    await history.updateOne({ _id: objectId }, { $set: donationData });
    const updatedDonation = await history.findOne({ _id: objectId }) as WithId<Donation> | null;
    if (!updatedDonation) {
        throw new Error('Donation not found after update.');
    }
    return serializeObject(updatedDonation);
}

export async function deleteDonationHistory(donationId: string) {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(donationId)) return { deletedCount: 0 };
    const history = await getCollection('donation_history');
    const result = await history.deleteOne({ _id: new ObjectId(donationId) });
    return { deletedCount: result.deletedCount };
}

// --- Admin/Shared Inventory Actions ---
export async function getAllInventory(): Promise<BloodUnit[]> {
    const inventoryCollection = await getCollection('blood_units');
    
    const inventory = await inventoryCollection.aggregate([
        {
            $lookup: {
                from: 'users',
                localField: 'location',
                foreignField: 'email',
                as: 'facilityInfo'
            }
        },
        {
            $unwind: {
                path: '$facilityInfo',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 1,
                bloodType: 1,
                donationType: 1,
                units: 1,
                collectionDate: 1,
                expirationDate: 1,
                location: 1,
                locationName: '$facilityInfo.name',
                locationEmail: '$facilityInfo.email',
                locationMobile: '$facilityInfo.mobileNumber'
            }
        }
    ]).toArray() as WithId<BloodUnit>[];

    return inventory.map(u => serializeObject(u));
}

// Helper function to update a facility's inventory summary
export async function updateFacilityInventorySummary(facilityEmail: string) {
  const inventoryCollection = await getCollection('blood_units');
  const usersCollection = await getCollection('users');

  const inventory = await inventoryCollection.find({ location: facilityEmail }).toArray();

  const inventorySummary = {
    whole_blood: 0,
    plasma: 0,
    red_blood_cells: 0,
  };
  const availableBloodTypes = new Set<string>();

  inventory.forEach(unit => {
    if (unit.donationType in inventorySummary) {
      inventorySummary[unit.donationType as DonationType] += unit.units;
    }
    availableBloodTypes.add(unit.bloodType);
  });

  await usersCollection.updateOne(
    { email: facilityEmail },
    {
      $set: {
        inventorySummary: inventorySummary,
        availableBloodTypes: Array.from(availableBloodTypes),
      },
    }
  );
}


// Hospital Actions
export async function getHospitalInventory(hospitalEmail: string): Promise<BloodUnit[]> {
  const inventoryCollection = await getCollection('blood_units');
  const inventory = await inventoryCollection.find({ location: hospitalEmail }).toArray() as WithId<BloodUnit>[];
  return inventory.map(u => serializeObject(u));
}

function getExpirationDate(collectionDate: Date, donationType: DonationType): Date {
    let daysToAdd = 42; // Default for whole_blood and red_blood_cells
    if (donationType === 'plasma') {
        daysToAdd = 365; // Plasma can be stored for a year
    }
    return addDays(collectionDate, daysToAdd);
}

export async function addBloodUnit(unit: Omit<BloodUnit, '_id' | 'expirationDate'>, hospitalEmail: string): Promise<BloodUnit> {
    const collectionDate = new Date(unit.collectionDate);
    const expirationDate = getExpirationDate(collectionDate, unit.donationType);
    const inventory = await getCollection('blood_units');

    const newUnit = {
      ...unit,
      collectionDate: collectionDate.toISOString(),
      expirationDate: expirationDate.toISOString(),
      location: hospitalEmail,
    };

    const result = await inventory.insertOne(newUnit);
    await updateFacilityInventorySummary(hospitalEmail); // Update summary
    const addedUnit = await inventory.findOne({ _id: result.insertedId }) as WithId<BloodUnit> | null;
    if (!addedUnit) throw new Error("Failed to add blood unit.");
    return serializeObject(addedUnit);
}

export async function updateBloodUnit(unitId: string, unitData: Partial<Omit<BloodUnit, '_id' | 'expirationDate'>>): Promise<BloodUnit> {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(unitId)) throw new Error("Invalid Unit ID");

    const inventory = await getCollection('blood_units');
    const objectId = new ObjectId(unitId);
    const existingUnit = await inventory.findOne({ _id: objectId }) as WithId<BloodUnit> | null;

    if (!existingUnit) throw new Error('Blood unit not found');

    const collectionDate = unitData.collectionDate ? new Date(unitData.collectionDate) : new Date(existingUnit.collectionDate);
    const donationType = unitData.donationType || existingUnit.donationType;
    const expirationDate = getExpirationDate(collectionDate, donationType as DonationType);
    
    const updateData = {
        ...unitData,
        collectionDate: collectionDate.toISOString(),
        expirationDate: expirationDate.toISOString(),
    };
    
    await inventory.updateOne({ _id: objectId }, { $set: updateData });
    await updateFacilityInventorySummary(existingUnit.location); // Update summary
    const updatedUnit = await inventory.findOne({ _id: objectId }) as WithId<BloodUnit> | null;
    if (!updatedUnit) throw new Error("Failed to update blood unit.");
    return serializeObject(updatedUnit);
}

export async function deleteBloodUnit(unitId: string): Promise<{ deletedCount?: number }> {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(unitId)) return { deletedCount: 0 };
    const inventory = await getCollection('blood_units');
    const objectId = new ObjectId(unitId);
    const existingUnit = await inventory.findOne({ _id: objectId });
    if (existingUnit) {
        const result = await inventory.deleteOne({ _id: objectId });
        await updateFacilityInventorySummary(existingUnit.location); // Update summary
        return { deletedCount: result.deletedCount };
    }
    return { deletedCount: 0 };
}

export async function addTransfer(transferData: Omit<Transfer, '_id'>): Promise<Transfer> {
    const transfers = await getCollection('transfers');
    const result = await transfers.insertOne(transferData);
    const newTransfer = await transfers.findOne({ _id: result.insertedId }) as WithId<Transfer> | null;
    if (!newTransfer) throw new Error("Failed to add transfer record.");
    return serializeObject(newTransfer);
}

export async function updateTransfer(transferId: string, transferData: Partial<Omit<Transfer, '_id'>>): Promise<Transfer> {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(transferId)) throw new Error("Invalid Transfer ID");
    const transfers = await getCollection('transfers');
    const objectId = new ObjectId(transferId);
    await transfers.updateOne({ _id: objectId }, { $set: transferData });
    const updated = await transfers.findOne({ _id: objectId }) as WithId<Transfer> | null;
    if (!updated) throw new Error("Failed to update transfer record.");
    return serializeObject(updated);
}

export async function getSentTransfers(email: string): Promise<Transfer[]> {
    const transfers = await getCollection('transfers');
    const sent = await transfers.find({ source: email }).sort({date: -1}).toArray() as WithId<Transfer>[];
    return sent.map(t => serializeObject(t));
}

export async function getReceivedTransfers(email: string): Promise<Transfer[]> {
    const transfers = await getCollection('transfers');
    const received = await transfers.find({ destination: email }).sort({date: -1}).toArray() as WithId<Transfer>[];
    return received.map(t => serializeObject(t));
}


// Blood Bank Actions
export async function getBloodBankInventory(bloodBankEmail: string): Promise<BloodUnit[]> {
  const inventoryCollection = await getCollection('blood_units');
  const inventory = await inventoryCollection.find({ location: bloodBankEmail }).toArray() as WithId<BloodUnit>[];
  return inventory.map(u => serializeObject(u));
}

export async function addBloodUnitToBank(unit: Omit<BloodUnit, '_id' | 'expirationDate'>, bloodBankEmail: string): Promise<BloodUnit> {
    return addBloodUnit(unit, bloodBankEmail);
}

export async function deleteBloodUnitFromBank(unitId: string): Promise<{ deletedCount?: number }> {
    return deleteBloodUnit(unitId);
}

// Blood Poll/Offer Actions
export async function createBloodOffer(offerData: Omit<BloodOffer, '_id' | 'date' | 'status'>): Promise<BloodOffer> {
    const offers = await getCollection('blood_offers');
    const newOfferData = {
        ...offerData,
        date: new Date().toISOString(),
        status: 'Available' as const,
    };
    const result = await offers.insertOne(newOfferData);
    const newOffer = await offers.findOne({ _id: result.insertedId }) as WithId<BloodOffer> | null;
    if (!newOffer) throw new Error("Failed to create blood offer.");
    return serializeObject(newOffer);
}

export async function getBloodOffers(): Promise<BloodOffer[]> {
    const offers = await getCollection('blood_offers');
    const allOffers = await offers.find({}).sort({date: -1}).toArray() as WithId<BloodOffer>[];
    return allOffers.map(o => serializeObject(o));
}

export async function claimBloodOffer(offerId: string, claimingUser: User): Promise<{ success: boolean; message: string }> {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(offerId)) return { success: false, message: 'Invalid offer ID.' };
    const offers = await getCollection('blood_offers');
    const objectId = new ObjectId(offerId);
    const offer = await offers.findOne({ _id: objectId });
    if (offer && offer.status === 'Available') {
        await offers.updateOne({ _id: objectId }, { $set: {
            status: 'Claimed',
            claimedByEmail: claimingUser.email,
            claimedByName: claimingUser.name,
        }});
        return Promise.resolve({ success: true, message: 'Offer successfully claimed!' });
    }
    return Promise.resolve({ success: false, message: 'Offer not available.' });
}

export async function cancelBloodOffer(offerId: string, userEmail: string): Promise<{ success: boolean; message: string }> {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(offerId)) return { success: false, message: 'Invalid offer ID.' };
    const offers = await getCollection('blood_offers');
    const result = await offers.deleteOne({ _id: new ObjectId(offerId), creatorEmail: userEmail });
    if (result.deletedCount === 1) {
        return Promise.resolve({ success: true, message: 'Offer has been cancelled.' });
    }
    return Promise.resolve({ success: false, message: 'Offer not found or permission denied.' });
}
