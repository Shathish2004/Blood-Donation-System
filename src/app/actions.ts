

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
import { addDays } from 'date-fns';

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


const mockUsers: User[] = [
    { _id: 'mock1', email: 'donor@test.com', password: 'password', role: 'Donor', name: 'John Doe', address: '123 Life St, Vital City', bloodType: 'O+', mobileNumber: '111-222-3333', city: 'Vital City', state: 'CA', country: 'USA', status: 'active' },
    { _id: 'mock2', email: 'individual@test.com', password: 'password', role: 'Individual', name: 'Jane Smith', address: '456 Health Ave, Metroburg', bloodType: 'A-', mobileNumber: '444-555-6666', city: 'Metroburg', state: 'NY', country: 'USA', status: 'active' },
    { _id: 'mock3', email: 'hospital@test.com', password: 'password', role: 'Hospital', name: 'City General Hospital', licenseNo: 'HOS12345', location: 'Downtown', mobileNumber: '777-888-9999', city: 'Metroburg', state: 'NY', country: 'USA', status: 'active', availableBloodTypes: ['O+', 'A-'], inventorySummary: { whole_blood: 15, plasma: 5, red_blood_cells: 0 } },
    { _id: 'mock4', email: 'bloodbank@test.com', password: 'password', role: 'Blood Bank', name: 'Regional Blood Bank', licenseNo: 'BB67890', location: 'Uptown', mobileNumber: '123-456-7890', city: 'Vital City', state: 'CA', country: 'USA', status: 'active', availableBloodTypes: ['B+', 'AB+'], inventorySummary: { whole_blood: 10, plasma: 0, red_blood_cells: 8 } },
    { _id: 'mock5', email: 'banned@test.com', password: 'password', role: 'Donor', name: 'Banned User', address: '999 Problem Rd', bloodType: 'B+', mobileNumber: '000-000-0000', city: 'Outcast City', state: 'FL', country: 'USA', status: 'banned' },
];

const mockInventory: BloodUnit[] = [
    { _id: '1', bloodType: 'O+', donationType: 'whole_blood', units: 10, collectionDate: '2023-10-01T00:00:00.000Z', expirationDate: '2023-11-12T00:00:00.000Z', location: 'hospital@test.com', locationName: 'City General Hospital', locationEmail: 'hospital@test.com', locationMobile: '777-888-9999'},
    { _id: '2', bloodType: 'A-', donationType: 'plasma', units: 5, collectionDate: '2023-09-15T00:00:00.000Z', expirationDate: '2024-09-14T00:00:00.000Z', location: 'hospital@test.com', locationName: 'City General Hospital', locationEmail: 'hospital@test.com', locationMobile: '777-888-9999'},
    { _id: '3', bloodType: 'B+', donationType: 'red_blood_cells', units: 8, collectionDate: '2023-10-10T00:00:00.000Z', expirationDate: '2023-11-21T00:00:00.000Z', location: 'bloodbank@test.com', locationName: 'Regional Blood Bank', locationEmail: 'bloodbank@test.com', locationMobile: '123-456-7890'},
    { _id: '4', bloodType: 'AB+', donationType: 'whole_blood', units: 2, collectionDate: '2023-10-20T00:00:00.000Z', expirationDate: '2023-12-01T00:00:00.000Z', location: 'bloodbank@test.com', locationName: 'Regional Blood Bank', locationEmail: 'bloodbank@test.com', locationMobile: '123-456-7890'},
];

const mockRequests: BloodRequest[] = [
    { _id: 'req1', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), bloodType: 'A-', donationType: 'red_blood_cells', units: 2, urgency: 'High', status: 'Pending', requester: 'individual@test.com' },
    { _id: 'req2', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), bloodType: 'O+', donationType: 'whole_blood', units: 1, urgency: 'Medium', status: 'In Progress', requester: 'individual@test.com', responder: 'donor@test.com' },
];

const mockNotifications: Notification[] = [
    { _id: 'notif1', type: 'request', requestId: 'req1', recipientEmail: 'donor@test.com', requesterEmail: 'individual@test.com', requesterName: 'Jane Smith', message: 'New red blood cells request for A- (2 units).', bloodType: 'A-', units: 2, urgency: 'High', date: new Date().toISOString(), read: false },
    { _id: 'notif2', type: 'response', requestId: 'req2', recipientEmail: 'individual@test.com', requesterEmail: 'donor@test.com', requesterName: 'John Doe', message: 'John Doe (Donor) has accepted your blood request.', bloodType: 'O+', units: 1, urgency: 'Medium', date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), read: true },
    { _id: 'notif3', type: 'emergency', recipientEmail: 'donor@test.com', requesterEmail: 'hospital@test.com', requesterName: 'City General Hospital', message: 'Emergency broadcast from City General Hospital: "Critical need for O- blood due to major accident."', bloodType: 'O-', units: 5, urgency: 'Critical', date: new Date(Date.now() - 10 * 60 * 1000).toISOString(), read: false, requestId: 'emergency1' },
];

const mockDonationHistory: Donation[] = [
    { _id: 'hist1', donorEmail: 'donor@test.com', date: '2023-08-15T00:00:00.000Z', location: 'City General Hospital', recipient: 'City General Hospital', units: 1, bloodType: 'O+' },
];

const mockOffers: BloodOffer[] = [
    { _id: 'offer1', creatorEmail: 'hospital@test.com', creatorName: 'City General Hospital', bloodType: 'A+', donationType: 'whole_blood', units: 5, message: 'Surplus units available.', date: new Date().toISOString(), status: 'Available' },
];


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
  try {
      const users = await getCollection('users');
      const user = await users.findOne({ email }) as WithId<DbUser> | null;

      if (user) {
        return serializeObject(user);
      }
      const mockUser = mockUsers.find(u => u.email === email);
      return mockUser ? { ...mockUser } : null;
  } catch (error) {
      console.error("Database error fetching user, falling back to mock data.", error);
      const mockUser = mockUsers.find(u => u.email === email);
      return mockUser ? { ...mockUser } : null;
  }
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
  try {
    const usersCollection = await getCollection('users');
    const users = await usersCollection.find({ role: { $ne: 'Admin' } }).toArray() as WithId<DbUser>[];
    if (users.length === 0) {
        return mockUsers.filter(u => u.role !== 'Admin');
    }
    return users.map(u => serializeObject(u));
  } catch (error) {
    console.error("Database error fetching all users, falling back to mock data.", error);
    return mockUsers.filter(u => u.role !== 'Admin');
  }
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
    try {
        const users = await getCollection('users');
        const inventory = await getCollection('blood_units');
        const requests = await getCollection('blood_requests');
        const transfers = await getCollection('transfers');

        const totalUsers = await users.countDocuments({ role: { $ne: 'Admin' } });
        const totalUnitsResult = await inventory.aggregate([{ $group: { _id: null, total: { $sum: '$units' } } }]).toArray();
        const totalUnits = totalUnitsResult[0]?.total || 0;
        const openRequests = await requests.countDocuments({ status: 'Pending' });
        const totalTransfers = await transfers.countDocuments();

        if (totalUsers === 0) {
             return Promise.resolve({
                totalUsers: 453,
                totalUnits: 1254,
                openRequests: 78,
                totalTransfers: 2930,
            });
        }
        
        return { totalUsers, totalUnits, openRequests, totalTransfers };

    } catch (error) {
        console.error("Database error fetching system stats, falling back to mock data.", error);
        return Promise.resolve({
            totalUsers: 453,
            totalUnits: 1254,
            openRequests: 78,
            totalTransfers: 2930,
        });
    }
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
  try {
    const requestsCollection = await getCollection('blood_requests');
    const requests = await requestsCollection.find({ requester: email }).sort({ date: -1 }).toArray() as WithId<BloodRequest>[];
    if (requests.length === 0 && mockRequests.some(r => r.requester === email)) return mockRequests.filter(r => r.requester === email);
    return requests.map(r => serializeObject(r));
  } catch (error) {
    console.error("Database error fetching blood requests, falling back to mock data.", error);
    return mockRequests.filter(r => r.requester === email);
  }
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
    try {
        const usersCollection = await getCollection('users');
        
        const donors = await usersCollection.aggregate([
            { $match: { role: { $ne: 'Admin' } } },
            {
                $lookup: {
                    from: 'blood_units',
                    localField: 'email',
                    foreignField: 'location',
                    as: 'inventory'
                }
            },
            {
                $addFields: {
                    inventorySummary: {
                        $cond: {
                            if: { $or: [{ $eq: ['$role', 'Hospital'] }, { $eq: ['$role', 'Blood Bank'] }] },
                            then: {
                                whole_blood: { $sum: { $map: { input: '$inventory', as: 'unit', in: { $cond: [{ $eq: ['$$unit.donationType', 'whole_blood'] }, '$$unit.units', 0] } } } },
                                plasma: { $sum: { $map: { input: '$inventory', as: 'unit', in: { $cond: [{ $eq: ['$$unit.donationType', 'plasma'] }, '$$unit.units', 0] } } } },
                                red_blood_cells: { $sum: { $map: { input: '$inventory', as: 'unit', in: { $cond: [{ $eq: ['$$unit.donationType', 'red_blood_cells'] }, '$$unit.units', 0] } } } }
                            },
                            else: '$$REMOVE'
                        }
                    },
                    availableBloodTypes: {
                         $cond: {
                            if: { $or: [{ $eq: ['$role', 'Hospital'] }, { $eq: ['$role', 'Blood Bank'] }] },
                            then: { $setUnion: [ '$inventory.bloodType' ] },
                            else: '$$REMOVE'
                        }
                    }
                }
            },
            {
                $project: {
                    inventory: 0 // Exclude the full inventory from the final result
                }
            }
        ]).toArray() as WithId<DbUser>[];

        if (donors.length === 0) return mockUsers;
        return donors.map(d => serializeObject(d));

    } catch (error) {
        console.error("Database error fetching potential donors, falling back to mock data.", error);
        return mockUsers;
    }
}

export async function getNotificationsForUser(email: string): Promise<Notification[]> {
  try {
    const notificationsCollection = await getCollection('notifications');
    const notifications = await notificationsCollection.find({ recipientEmail: email }).sort({ date: -1 }).toArray() as WithId<Notification>[];
    if (notifications.length === 0 && mockNotifications.some(n => n.recipientEmail === email)) {
        return mockNotifications.filter(n => n.recipientEmail === email);
    }
    return notifications.map(n => serializeObject(n));
  } catch (error) {
    console.error("Database error fetching notifications, falling back to mock data.", error);
    return mockNotifications.filter(n => n.recipientEmail === email);
  }
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
  try {
    const historyCollection = await getCollection('donation_history');
    const history = await historyCollection.find({ donorEmail }).sort({ date: -1 }).toArray() as WithId<Donation>[];
    if (history.length === 0 && mockDonationHistory.some(d => d.donorEmail === donorEmail)) return mockDonationHistory;
    return history.map(d => serializeObject(d));
  } catch (error) {
    console.error("Database error fetching donation history, falling back to mock data.", error);
    return mockDonationHistory.filter(d => d.donorEmail === donorEmail);
  }
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
    try {
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

        if (inventory.length === 0) {
            return mockInventory;
        }
        return inventory.map(u => serializeObject(u));
    } catch (error) {
        console.error("Database error fetching all inventory, falling back to mock data.", error);
        return mockInventory;
    }
}

// Helper function to update a facility's inventory summary
async function updateFacilityInventorySummary(facilityEmail: string) {
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
  try {
    const inventoryCollection = await getCollection('blood_units');
    const inventory = await inventoryCollection.find({ location: hospitalEmail }).toArray() as WithId<BloodUnit>[];
    if (inventory.length === 0 && mockInventory.some(u => u.location === hospitalEmail)) return mockInventory.filter(u => u.location === hospitalEmail);
    return inventory.map(u => serializeObject(u));
  } catch (error) {
    console.error("Database error fetching hospital inventory, falling back to mock data.", error);
    return mockInventory.filter(u => u.location === hospitalEmail);
  }
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
    try {
        const transfers = await getCollection('transfers');
        const sent = await transfers.find({ source: email }).sort({date: -1}).toArray() as WithId<Transfer>[];
        if (sent.length === 0) return [{ _id: 'sent1', date: new Date().toISOString(), source: email, destination: 'County Medical Center', bloodType: 'A+', units: 5, donationType: 'whole_blood' }];
        return sent.map(t => serializeObject(t));
    } catch (error) {
        console.error("Database error fetching sent transfers, falling back to mock data.", error);
        return [{ _id: 'sent1', date: new Date().toISOString(), source: email, destination: 'County Medical Center', bloodType: 'A+', units: 5, donationType: 'whole_blood' }];
    }
}

export async function getReceivedTransfers(email: string): Promise<Transfer[]> {
    try {
        const transfers = await getCollection('transfers');
        const received = await transfers.find({ destination: email }).sort({date: -1}).toArray() as WithId<Transfer>[];
        if (received.length === 0) return [{ _id: 'rec1', date: new Date().toISOString(), source: 'Regional Blood Bank', destination: email, bloodType: 'O-', units: 10, donationType: 'red_blood_cells' }];
        return received.map(t => serializeObject(t));
    } catch (error) {
        console.error("Database error fetching received transfers, falling back to mock data.", error);
        return [{ _id: 'rec1', date: new Date().toISOString(), source: 'Regional Blood Bank', destination: email, bloodType: 'O-', units: 10, donationType: 'red_blood_cells' }];
    }
}


// Blood Bank Actions
export async function getBloodBankInventory(bloodBankEmail: string): Promise<BloodUnit[]> {
  try {
    const inventoryCollection = await getCollection('blood_units');
    const inventory = await inventoryCollection.find({ location: bloodBankEmail }).toArray() as WithId<BloodUnit>[];
    if (inventory.length === 0 && mockInventory.some(u => u.location === bloodBankEmail)) return mockInventory.filter(u => u.location === bloodBankEmail);
    return inventory.map(u => serializeObject(u));
  } catch (error) {
    console.error("Database error fetching blood bank inventory, falling back to mock data.", error);
    return mockInventory.filter(u => u.location === bloodBankEmail);
  }
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
    try {
        const offers = await getCollection('blood_offers');
        const allOffers = await offers.find({}).sort({date: -1}).toArray() as WithId<BloodOffer>[];
        if (allOffers.length === 0) return mockOffers;
        return allOffers.map(o => serializeObject(o));
    } catch (error) {
        console.error("Database error fetching blood offers, falling back to mock data.", error);
        return mockOffers;
    }
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

    

    