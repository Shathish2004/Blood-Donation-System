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
import type {BloodRequest, Notification, Urgency, Donation, BloodUnit, Transfer, BloodOffer} from '@/lib/types';
import type {WithId, Document} from 'mongodb';
import nodemailer from 'nodemailer';
import { addDays } from 'date-fns';

export type User = {
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
  status?: 'active' | 'banned';
};

// Helper function to get the database and a collection
async function getCollection(collectionName: string) {
  const client = await clientPromise;
  const db = client.db();
  return db.collection(collectionName);
}

// Type guard to check if a document is a User
function isUser(doc: WithId<Document> | null): doc is User & {_id: any} {
  return doc !== null && 'email' in doc && 'role' in doc;
}

export const saveUser = async (user: User): Promise<User> => {
  const users = await getCollection('users');
  // MongoDB automatically adds an _id field. We can remove it before returning if needed.
  const result = await users.insertOne({...user, status: 'active'});
  if (!result.acknowledged) {
    throw new Error('User could not be saved.');
  }
  const {_id, ...userWithoutId} = user as User & {_id: any};
  return {...userWithoutId, status: 'active'};
};

export const getUser = async (email: string): Promise<User | null> => {
  if (email === 'admin@bloodnet.com') {
    return {
      email: 'admin@bloodnet.com',
      role: 'Admin',
      name: 'Administrator',
      status: 'active',
    }
  }
  const users = await getCollection('users');
  const userDoc = await users.findOne({email});

  if (isUser(userDoc)) {
    const {_id, ...user} = userDoc;
    return user;
  }

  return null;
};

export const updateUser = async (
  email: string,
  newData: Partial<User>
): Promise<User> => {
  const users = await getCollection('users');
  const result = await users.findOneAndUpdate(
    {email},
    {$set: newData},
    {returnDocument: 'after'}
  );

  if (!result) {
    throw new Error('User not found or could not be updated.');
  }

  const {_id, ...updatedUser} = result as User & {_id: any};

  return updatedUser;
};

// --- Admin Actions ---

export async function getAllUsers(): Promise<User[]> {
  const usersCollection = await getCollection('users');
  const users = await usersCollection.find({}).toArray();

  return users.map((doc) => {
    const { _id, password, ...user } = doc;
    return user as User;
  });
}

export async function deleteUser(email: string): Promise<{ deletedCount?: number }> {
    const usersCollection = await getCollection('users');
    if (email === 'admin@bloodnet.com') {
        throw new Error('Cannot delete admin user.');
    }
    try {
        const result = await usersCollection.deleteOne({ email });
        return { deletedCount: result.deletedCount };
    } catch (e) {
        console.error(e);
        return { deletedCount: 0 };
    }
}

export async function updateUserStatus(email: string, status: 'active' | 'banned'): Promise<User> {
    return updateUser(email, { status });
}

export async function getSystemStats() {
    const users = await getCollection('users');
    const blood_units = await getCollection('blood_units');
    const blood_requests = await getCollection('blood_requests');
    const transfers = await getCollection('transfers');

    const totalUsers = await users.countDocuments();
    const totalUnits = (await blood_units.aggregate([ { $group: { _id: null, total: { $sum: "$units" } } } ]).toArray())[0]?.total || 0;
    const openRequests = await blood_requests.countDocuments({ status: { $in: ['Pending', 'In Progress'] } });
    const totalTransfers = await transfers.countDocuments();

    return {
        totalUsers,
        totalUnits,
        openRequests,
        totalTransfers,
    };
}

export async function getDemandForecast(input: DemandForecastInput): Promise<DemandForecastOutput> {
    try {
        const result = await forecastDemand(input);
        return result;
    } catch (error) {
        console.error('Error getting demand forecast:', error);
        throw new Error('Failed to get forecast from AI.');
    }
}

export async function getHistoricalDataForForecast(): Promise<{requests: BloodRequest[], inventory: BloodUnit[]}> {
    const requestsCollection = await getCollection('blood_requests');
    const unitsCollection = await getCollection('blood_units');
    
    // Get data from the last 90 days for forecasting
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const requests = await requestsCollection.find({ date: { $gte: ninetyDaysAgo.toISOString() } }).toArray();
    const inventory = await unitsCollection.find({ collectionDate: { $gte: ninetyDaysAgo.toISOString() } }).toArray();
    
    const serializedRequests = requests.map(doc => {
      const { _id, ...rest } = doc;
      return { id: _id.toString(), ...rest, date: new Date(doc.date).toISOString() } as BloodRequest;
    });

    const serializedInventory = inventory.map(doc => {
      const { _id, ...rest } = doc;
      return { id: _id.toString(), ...rest, collectionDate: new Date(doc.collectionDate as Date).toISOString(), expirationDate: new Date(doc.expirationDate as Date).toISOString() } as BloodUnit;
    });
    
    return { requests: serializedRequests, inventory: serializedInventory };
}


// --- AI Actions ---

export async function estimateExpiration(
  input: EstimateBloodExpirationDateInput
): Promise<EstimateBloodExpirationDateOutput> {
  try {
    const result = await estimateBloodExpirationDate(input);
    return result;
  } catch (error) {
    console.error('Error estimating blood expiration date:', error);
    throw new Error('Failed to get estimation from AI.');
  }
}

export async function findInventoryMatches(
  input: MatchInventoryToRequestsInput
): Promise<MatchInventoryToRequestsOutput> {
  try {
    const result = await matchInventoryToRequests(input);
    return result;
  } catch (error) {
    console.error('Error matching inventory to requests:', error);
    throw new Error('Failed to get matches from AI.');
  }
}

export async function findBloodReportMatch(
  input: MatchBloodReportsInput
): Promise<MatchBloodReportsOutput> {
  try {
    const result = await matchBloodReports(input);
    return result;
  } catch (error) {
    console.error('Error matching blood reports:', error);
    throw new Error('Failed to get match from AI.');
  }
}

// --- User Actions ---

export async function updateUserData(email: string, data: any) {
  try {
    const updatedUser = await updateUser(email, data);
    return updatedUser;
  } catch (error) {
    console.error('Error updating user data:', error);
    throw new Error('Failed to update user data.');
  }
}

export async function createBloodRequest(request: {
  requester: string;
  bloodType: string;
  units: number;
  urgency: Urgency;
}) {
  const requests = await getCollection('blood_requests');
  const newRequest: Omit<BloodRequest, 'id'> = {
    ...request,
    date: new Date().toISOString(),
    status: 'Pending',
  };
  const result = await requests.insertOne(newRequest);
  if (!result.acknowledged) {
    throw new Error('Blood request could not be created.');
  }
  const requestId = result.insertedId.toString();

  // Create notifications for targeted responders
  const users = await getCollection('users');
  const potentialResponders = await users.find({
      // Notify all active donors, hospitals, and blood banks
      role: { $in: ['Donor', 'Hospital', 'Blood Bank'] },
      status: 'active'
    }).toArray();

  const notifications = await getCollection('notifications');
  const notificationPromises = potentialResponders.map(responder => {
    // Do not notify the requester themselves
    if (responder.email === request.requester) return null;

    return notifications.insertOne({
      type: 'request',
      requestId: requestId,
      recipientEmail: responder.email,
      requesterEmail: request.requester,
      bloodType: request.bloodType,
      units: request.units,
      urgency: request.urgency,
      date: new Date(),
      read: false,
      message: `New blood request for ${request.bloodType} (${request.units} units).`,
    });
  }).filter(Boolean); // Filter out null promises
  await Promise.all(notificationPromises);

  const finalRequest = await requests.findOne({_id: result.insertedId});
  if (!finalRequest) throw new Error('Failed to retrieve new request.');

  const { _id, ...rest } = finalRequest;
  return {
    id: _id.toString(),
    ...rest,
    date: new Date(rest.date).toISOString(),
  } as BloodRequest;
}

export async function createDirectBloodRequest(request: {
  requester: User;
  recipient: User;
  bloodType: string;
  units: number;
  urgency: Urgency;
}) {
  // 1. Save the blood request
  const requests = await getCollection('blood_requests');
  const newRequest: Omit<BloodRequest, 'id'> = {
    requester: request.requester.email,
    bloodType: request.bloodType,
    units: request.units, 
    urgency: request.urgency, 
    date: new Date().toISOString(),
    status: 'Pending',
  };
  const requestResult = await requests.insertOne(newRequest);
  const requestId = requestResult.insertedId.toString();


  // 2. Create an in-app notification
  const notifications = await getCollection('notifications');
  const message = `${request.requester.name} has sent you a direct request for ${request.units} unit(s) of ${request.bloodType} blood.`;
  await notifications.insertOne({
      type: 'request',
      requestId: requestId,
      recipientEmail: request.recipient.email,
      requesterEmail: request.requester.email,
      bloodType: request.bloodType,
      units: request.units,
      urgency: request.urgency,
      date: new Date(),
      read: false,
      message,
  });

  // 3. Send an email notification if recipient is a donor
  if (request.recipient.role === 'Donor') {
    await sendDirectRequestEmail(request.recipient, request.requester);
  }

  return { success: true, message: `Request sent to ${request.recipient.name}` };
}

export async function createEmergencyPoll(requester: User, message: string) {
    const usersCollection = await getCollection('users');
    const allUsers = await usersCollection.find({ email: { $ne: requester.email }, status: 'active' }).toArray(); // Don't notify self, only active users
    const notifications = await getCollection('notifications');
    
    const urgentMessage = `Emergency broadcast from ${requester.name}: "${message}"`;

    const notificationPromises = allUsers.map(user => {
        return notifications.insertOne({
            type: 'info', // Using 'info' type for a general broadcast
            recipientEmail: user.email,
            requesterEmail: requester.email,
            message: urgentMessage,
            bloodType: 'N/A', // Not specific to a blood type
            units: 0,
            urgency: 'Critical',
            date: new Date(),
            read: false,
        });
    });

    await Promise.all(notificationPromises);
    return { success: true, message: 'Emergency poll sent to all users.' };
}

export async function sendDirectRequestEmail(recipient: User, requester: User) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: recipient.email,
    subject: 'Urgent Blood Request from BloodNet',
    text: `Hello ${recipient.name},\n\nYou have received a direct blood request from ${requester.name} for blood type ${recipient.bloodType}.\n\nPlease log in to your BloodNet dashboard to respond.\n\nThank you for your help in saving lives.`,
    html: `<p>Hello ${recipient.name},</p><p>You have received a direct blood request from <strong>${requester.name}</strong> for blood type <strong>${recipient.bloodType}</strong>.</p><p>Please log in to your BloodNet dashboard to respond.</p><p>Thank you for your help in saving lives.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to', recipient.email);
  } catch (error) {
    console.error('Error sending email:', error);
    // We don't throw an error here to avoid breaking the frontend flow
    // In a real app, you'd have more robust error handling/logging
  }
}

export async function getBloodRequestsForUser(
  email: string
): Promise<BloodRequest[]> {
  const requests = await getCollection('blood_requests');
  const userRequests = await requests.find({requester: email}).toArray();

  return userRequests.map((doc: Document) => {
    const { _id, ...rest } = doc;
    return {
      id: _id.toString(),
      ...rest,
      date: new Date(doc.date).toISOString(),
    } as BloodRequest;
  });
}

export async function cancelBloodRequest(
  requestId: string
): Promise<{deletedCount?: number}> {
  const requests = await getCollection('blood_requests');
  const {ObjectId} = require('mongodb');
  try {
    const result = await requests.deleteOne({_id: new ObjectId(requestId)});
    return {deletedCount: result.deletedCount};
  } catch (e) {
    console.error(e);
    // handle case where requestId is not a valid ObjectId string
    return {deletedCount: 0};
  }
}

export async function getPotentialDonors(): Promise<User[]> {
    const usersCollection = await getCollection('users');
    const bloodUnitsCollection = await getCollection('blood_units');

    // 1. Get all potential responders
    const users = await usersCollection.find({
        role: { $in: ['Donor', 'Hospital', 'Blood Bank'] },
        status: 'active',
    }).toArray();

    // 2. Get distinct blood types for each hospital/blood bank
    const facilities = users.filter(u => u.role === 'Hospital' || u.role === 'Blood Bank');
    const bloodTypesByFacility = await Promise.all(
        facilities.map(async (facility) => {
            const bloodTypes = await bloodUnitsCollection.distinct('bloodType', { location: facility.email });
            return { email: facility.email, bloodTypes };
        })
    );

    // 3. Create a map for easy lookup
    const bloodTypesMap = new Map(bloodTypesByFacility.map(item => [item.email, item.bloodTypes]));

    // 4. Combine user data with available blood types for facilities
    const potentialDonors = users.map((doc) => {
        const { _id, password, ...user } = doc;
        
        let finalUser: User = user as User;

        if (user.role === 'Hospital' || user.role === 'Blood Bank') {
            finalUser.availableBloodTypes = bloodTypesMap.get(user.email) || [];
        }
        
        return finalUser;
    });

    return potentialDonors;
}

export async function getNotificationsForUser(email: string): Promise<Notification[]> {
  const notifications = await getCollection('notifications');
  const users = await getCollection('users');

  const userNotifications = await notifications.find({ recipientEmail: email }).sort({ date: -1 }).limit(20).toArray();

  const enhancedNotifications = await Promise.all(userNotifications.map(async (doc) => {
    const requester = await users.findOne({ email: doc.requesterEmail });
    const { _id, date, ...rest } = doc;
    return {
      id: _id.toString(),
      date: new Date(date as Date).toISOString(),
      requesterName: requester?.name || doc.requesterEmail, // Fallback to email
      requesterEmail: requester?.email || '',
      requesterMobileNumber: requester?.mobileNumber || '',
      ...rest
    } as Notification;
  }));

  return enhancedNotifications;
}

export async function markNotificationAsRead(notificationId: string) {
  const notifications = await getCollection('notifications');
  const { ObjectId } = require('mongodb');
  try {
    await notifications.updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { read: true } }
    );
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false };
  }
}

export async function respondToRequest(requestId: string, responder: User, requesterEmail: string) {
    const requests = await getCollection('blood_requests');
    const { ObjectId } = require('mongodb');
    const notifications = await getCollection('notifications');
    
    try {
        await requests.updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: 'In Progress', responder: responder.email } }
        );

        await notifications.insertOne({
            type: 'response',
            requestId: requestId,
            recipientEmail: requesterEmail,
            requesterEmail: responder.email, // The 'requester' of the notification is the responder
            date: new Date(),
            read: false,
            message: `${responder.name} (${responder.role}) has accepted your blood request.`,
        });

        // This would remove the notification from the donor's list after they respond
        // but let's keep it for history, and just filter on the frontend
        
        return { success: true, message: 'Response sent and request status updated.' };

    } catch (e) {
        console.error(e);
        return { success: false, message: 'Failed to respond to request.' };
    }
}

export async function declineRequest(notificationId: string, requestId: string, responder: User, requesterEmail: string, reason: string) {
    const notifications = await getCollection('notifications');
    const requests = await getCollection('blood_requests');
    const { ObjectId } = require('mongodb');
    
    try {
        // 1. Send a "decline" notification to the original requester
        await notifications.insertOne({
            type: 'decline',
            requestId: requestId,
            recipientEmail: requesterEmail,
            requesterEmail: responder.email,
            date: new Date(),
            read: false,
            message: `${responder.name} (${responder.role}) has declined your request. Reason: ${reason}`,
        });

        // 2. Delete the original request notification from the donor's list
        await notifications.deleteOne({
            _id: new ObjectId(notificationId)
        });

        // 3. Delete the original blood request
        await requests.deleteOne({
            _id: new ObjectId(requestId)
        });

        return { success: true, message: 'Decline notification sent and your request list has been updated.' };

    } catch (e) {
        console.error(e);
        return { success: false, message: 'Failed to send decline notification.' };
    }
}

export async function getDonationHistory(donorEmail: string): Promise<Donation[]> {
  const history = await getCollection('donation_history');
  const donorHistory = await history.find({ donorEmail }).sort({ date: -1 }).limit(10).toArray();

  return donorHistory.map((doc) => {
    const { _id, ...rest } = doc;
    return {
      id: _id.toString(),
      ...rest,
      date: new Date(doc.date as Date).toISOString(),
    } as Donation;
  });
}


export async function addDonationHistory(donation: Omit<Donation, 'id'> & { donorEmail: string }): Promise<Donation> {
  const history = await getCollection('donation_history');
  
  const donationWithDate = {
    ...donation,
    date: new Date(donation.date), // Ensure date is a Date object for MongoDB
  };

  const result = await history.insertOne(donationWithDate);
  if (!result.acknowledged) {
    throw new Error('Donation history could not be added.');
  }
  
  // Return a serialized object
  const newDonation = await history.findOne({ _id: result.insertedId });
  if (!newDonation) {
    throw new Error('Failed to retrieve new donation.');
  }

  const { _id, ...rest } = newDonation;
  return {
    id: _id.toString(),
    ...rest,
    date: new Date(rest.date).toISOString(),
  } as Donation;
}

export async function deleteDonationHistory(donationId: string) {
  const history = await getCollection('donation_history');
  const { ObjectId } = require('mongodb');
  try {
    const result = await history.deleteOne({ _id: new ObjectId(donationId) });
    return { deletedCount: result.deletedCount };
  } catch (e) {
    console.error(e);
    return { deletedCount: 0 };
  }
}

// Hospital Actions
export async function getHospitalInventory(hospitalEmail: string): Promise<BloodUnit[]> {
  const units = await getCollection('blood_units');
  const hospitalInventory = await units.find({ location: hospitalEmail, role: 'Hospital' }).sort({ expirationDate: 1 }).toArray();

  return hospitalInventory.map(doc => {
    const { _id, collectionDate, expirationDate, ...rest } = doc;
    return {
      id: _id.toString(),
      collectionDate: new Date(collectionDate as Date).toISOString(),
      expirationDate: new Date(expirationDate as Date).toISOString(),
      ...rest,
    } as BloodUnit;
  });
}

export async function addBloodUnit(unit: Omit<BloodUnit, 'id' | 'expirationDate'>, hospitalEmail: string): Promise<BloodUnit> {
  const units = await getCollection('blood_units');
  const newUnit = {
    ...unit,
    collectionDate: new Date(unit.collectionDate),
    expirationDate: addDays(new Date(unit.collectionDate), 42), // Expiration is 42 days from collection
    location: hospitalEmail,
    role: 'Hospital'
  };

  const result = await units.insertOne(newUnit);
  if (!result.acknowledged) {
    throw new Error('Could not add blood unit.');
  }

  const savedUnit = await units.findOne({ _id: result.insertedId });
  if (!savedUnit) {
    throw new Error('Failed to retrieve new unit.');
  }

  const { _id, collectionDate, expirationDate, ...rest } = savedUnit;
  return {
    id: _id.toString(),
    collectionDate: new Date(collectionDate).toISOString(),
    expirationDate: new Date(expirationDate).toISOString(),
    ...rest,
  } as BloodUnit;
}


export async function updateBloodUnit(unitId: string, unitData: Partial<Omit<BloodUnit, 'id'>>): Promise<BloodUnit> {
    const units = await getCollection('blood_units');
    const { ObjectId } = require('mongodb');

    // If collectionDate is being updated, recalculate expirationDate
    if (unitData.collectionDate) {
        unitData.expirationDate = addDays(new Date(unitData.collectionDate), 42);
    }
    
    const result = await units.findOneAndUpdate(
        { _id: new ObjectId(unitId) },
        { $set: unitData },
        { returnDocument: 'after' }
    );

    if (!result) {
        throw new Error('Blood unit not found or could not be updated.');
    }

    const { _id, collectionDate, expirationDate, ...rest } = result;
    return {
        id: _id.toString(),
        collectionDate: new Date(collectionDate).toISOString(),
        expirationDate: new Date(expirationDate).toISOString(),
        ...rest,
    } as BloodUnit;
}


export async function deleteBloodUnit(unitId: string): Promise<{ deletedCount?: number }> {
    const units = await getCollection('blood_units');
    const { ObjectId } = require('mongodb');
    try {
        const result = await units.deleteOne({ _id: new ObjectId(unitId) });
        return { deletedCount: result.deletedCount };
    } catch (e) {
        console.error(e);
        return { deletedCount: 0 };
    }
}

export async function addTransfer(transferData: Omit<Transfer, 'id'>): Promise<Transfer> {
    const transfers = await getCollection('transfers');
    const result = await transfers.insertOne({ ...transferData, date: new Date(transferData.date) });
    if (!result.acknowledged) {
        throw new Error('Could not add transfer record.');
    }

    const newTransfer = await transfers.findOne({ _id: result.insertedId });
    if (!newTransfer) {
        throw new Error('Failed to retrieve new transfer record.');
    }

    const { _id, ...rest } = newTransfer;
    return {
        id: _id.toString(),
        ...rest,
        date: new Date(rest.date).toISOString(),
    } as Transfer;
}

export async function getSentTransfers(email: string): Promise<Transfer[]> {
    const transfers = await getCollection('transfers');
    const sentTransfers = await transfers.find({ source: email }).sort({ date: -1 }).toArray();

    return sentTransfers.map(doc => {
        const { _id, date, ...rest } = doc;
        return {
            id: _id.toString(),
            date: new Date(date as Date).toISOString(),
            ...rest
        } as Transfer;
    });
}

export async function getReceivedTransfers(email: string): Promise<Transfer[]> {
    const transfers = await getCollection('transfers');
    const receivedTransfers = await transfers.find({ destination: email }).sort({ date: -1 }).toArray();

    return receivedTransfers.map(doc => {
        const { _id, date, ...rest } = doc;
        return {
            id: _id.toString(),
            date: new Date(date as Date).toISOString(),
            ...rest
        } as Transfer;
    });
}


// Blood Bank Actions
export async function getBloodBankInventory(bloodBankEmail: string): Promise<BloodUnit[]> {
  const units = await getCollection('blood_units');
  const bankInventory = await units.find({ location: bloodBankEmail, role: 'Blood Bank' }).sort({ expirationDate: 1 }).toArray();

  return bankInventory.map(doc => {
    const { _id, collectionDate, expirationDate, ...rest } = doc;
    return {
      id: _id.toString(),
      collectionDate: new Date(collectionDate as Date).toISOString(),
      expirationDate: new Date(expirationDate as Date).toISOString(),
      ...rest,
    } as BloodUnit;
  });
}

export async function addBloodUnitToBank(unit: Omit<BloodUnit, 'id' | 'expirationDate'>, bloodBankEmail: string): Promise<BloodUnit> {
  const units = await getCollection('blood_units');
  const newUnit = {
    ...unit,
    collectionDate: new Date(unit.collectionDate),
    expirationDate: addDays(new Date(unit.collectionDate), 42),
    location: bloodBankEmail,
    role: 'Blood Bank'
  };

  const result = await units.insertOne(newUnit);
  if (!result.acknowledged) {
    throw new Error('Could not add blood unit to bank.');
  }

  const savedUnit = await units.findOne({ _id: result.insertedId });
  if (!savedUnit) {
    throw new Error('Failed to retrieve new unit.');
  }

  const { _id, collectionDate, expirationDate, ...rest } = savedUnit;
  return {
    id: _id.toString(),
    collectionDate: new Date(collectionDate).toISOString(),
    expirationDate: new Date(expirationDate).toISOString(),
    ...rest,
  } as BloodUnit;
}

export async function deleteBloodUnitFromBank(unitId: string): Promise<{ deletedCount?: number }> {
    const units = await getCollection('blood_units');
    const { ObjectId } = require('mongodb');
    try {
        const result = await units.deleteOne({ _id: new ObjectId(unitId) });
        return { deletedCount: result.deletedCount };
    } catch (e) {
        console.error(e);
        return { deletedCount: 0 };
    }
}

// Blood Poll/Offer Actions
export async function createBloodOffer(offerData: Omit<BloodOffer, 'id' | 'date' | 'status'>): Promise<BloodOffer> {
    const offers = await getCollection('blood_offers');
    const newOffer = {
        ...offerData,
        date: new Date().toISOString(),
        status: 'Available' as const,
    };

    const result = await offers.insertOne(newOffer);
    if (!result.acknowledged) {
        throw new Error('Could not create blood offer.');
    }

    const savedOffer = await offers.findOne({ _id: result.insertedId });
    if (!savedOffer) {
        throw new Error('Failed to retrieve new offer.');
    }
    
    // Notify all other hospitals and blood banks
    const users = await getCollection('users');
    const otherFacilities = await users.find({
        role: { $in: ['Hospital', 'Blood Bank'] },
        email: { $ne: offerData.creatorEmail },
        status: 'active'
    }).toArray();

    const notifications = await getCollection('notifications');
    const message = `${offerData.creatorName} is offering ${offerData.units} unit(s) of ${offerData.bloodType} blood.`;
    const notificationPromises = otherFacilities.map(facility => {
        return notifications.insertOne({
            type: 'offer',
            offerId: savedOffer._id.toString(),
            recipientEmail: facility.email,
            requesterEmail: offerData.creatorEmail, // 'requester' is the creator of the offer
            message,
            bloodType: offerData.bloodType,
            units: offerData.units,
            urgency: 'Low',
            date: new Date(),
            read: false,
        });
    });
    await Promise.all(notificationPromises);

    const { _id, ...rest } = savedOffer;
    return {
        id: _id.toString(),
        date: new Date(rest.date).toISOString(),
        ...rest
    } as BloodOffer;
}

export async function getBloodOffers(): Promise<BloodOffer[]> {
    const offers = await getCollection('blood_offers');
    const allOffers = await offers.find({}).sort({ date: -1 }).toArray();

    return allOffers.map(doc => {
        const { _id, date, ...rest } = doc;
        return {
            id: _id.toString(),
            date: new Date(date as Date).toISOString(),
            ...rest
        } as BloodOffer;
    });
}

export async function claimBloodOffer(offerId: string, claimingUser: User): Promise<{ success: boolean; message: string }> {
    const offers = await getCollection('blood_offers');
    const { ObjectId } = require('mongodb');

    const offer = await offers.findOne({ _id: new ObjectId(offerId) });
    if (!offer) {
        return { success: false, message: 'Offer not found.' };
    }
    if (offer.status !== 'Available') {
        return { success: false, message: `Offer is no longer available. Status: ${offer.status}` };
    }

    const result = await offers.updateOne(
        { _id: new ObjectId(offerId) },
        { $set: { status: 'Claimed', claimedByEmail: claimingUser.email, claimedByName: claimingUser.name } }
    );

    if (result.modifiedCount === 0) {
        return { success: false, message: 'Failed to claim offer.' };
    }

    // Notify the creator that their offer has been claimed
    const notifications = await getCollection('notifications');
    await notifications.insertOne({
        type: 'claim',
        offerId: offerId,
        recipientEmail: offer.creatorEmail,
        requesterEmail: claimingUser.email,
        message: `${claimingUser.name} has claimed your offer for ${offer.units} unit(s) of ${offer.bloodType} blood.`,
        date: new Date(),
        read: false,
    });

    return { success: true, message: 'Offer successfully claimed!' };
}

export async function cancelBloodOffer(offerId: string, userEmail: string): Promise<{ success: boolean; message: string }> {
    const offers = await getCollection('blood_offers');
    const { ObjectId } = require('mongodb');

    const offer = await offers.findOne({ _id: new ObjectId(offerId), creatorEmail: userEmail });
    if (!offer) {
        return { success: false, message: 'Offer not found or you do not have permission to cancel it.' };
    }

    const result = await offers.deleteOne({ _id: new ObjectId(offerId) });
    
    if (result.deletedCount === 0) {
        return { success: false, message: 'Failed to cancel offer.' };
    }
    
    // Optional: Also delete notifications related to this offer
    const notifications = await getCollection('notifications');
    await notifications.deleteMany({ offerId: offerId });

    return { success: true, message: 'Offer has been cancelled.' };
}
