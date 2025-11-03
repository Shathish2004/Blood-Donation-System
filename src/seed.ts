
import { config } from 'dotenv';
config();

import clientPromise from './lib/mongodb';
import { User, BloodUnit, Notification, BloodRequest, Donation, BloodOffer, DonationType, BloodType } from './lib/types';
import { updateFacilityInventorySummary } from './app/actions';
import { addDays, subDays } from 'date-fns';

const generateUsers = () => {
    const users: Omit<User, '_id'>[] = [];
    const roles: ('Donor' | 'Individual' | 'Hospital' | 'Blood Bank')[] = ['Donor', 'Individual', 'Hospital', 'Blood Bank'];
    const bloodTypes: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const states = ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Uttar Pradesh", "West Bengal", "Rajasthan", "Gujarat"];
    const districts: { [key: string]: string[] } = {
        "Maharashtra": ["Mumbai City", "Pune", "Nagpur", "Thane", "Nashik"],
        "Delhi": ["New Delhi", "South Delhi", "North Delhi", "West Delhi", "East Delhi"],
        "Karnataka": ["Bengaluru Urban", "Mysuru", "Mangaluru", "Hubballi-Dharwad", "Belagavi"],
        "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
        "Uttar Pradesh": ["Lucknow", "Ghaziabad", "Agra", "Varanasi", "Meerut"],
        "West Bengal": ["Kolkata", "Howrah", "North 24 Parganas", "South 24 Parganas", "Hooghly"],
        "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Udaipur"],
        "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
    };

    let userCounter = 1;

    for (const role of roles) {
        for (let i = 1; i <= 10; i++) {
            const state = states[userCounter % states.length];
            const city = districts[state][i % districts[state].length];
            const user: Partial<Omit<User, '_id'>> = {
                role,
                status: 'active',
                state,
                city,
                country: 'India',
                mobileNumber: `9876543${(userCounter).toString().padStart(3, '0')}`,
            };

            switch (role) {
                case 'Donor':
                    user.name = `Donor ${i}`;
                    user.email = `donor${i}@test.com`;
                    user.password = 'password';
                    user.bloodType = bloodTypes[i % bloodTypes.length];
                    user.address = `${i} Donor Lane, ${city}`;
                    break;
                case 'Individual':
                    user.name = `Individual ${i}`;
                    user.email = `individual${i}@test.com`;
                    user.password = 'password';
                    user.bloodType = bloodTypes[(i + 2) % bloodTypes.length];
                    user.address = `${i} Patient St, ${city}`;
                    break;
                case 'Hospital':
                    user.name = `${city} General Hospital ${i}`;
                    user.email = `hospital${i}@test.com`;
                    user.password = 'password';
                    user.licenseNo = `HOS${(1000 + i)}`;
                    user.location = `${city}`;
                    break;
                case 'Blood Bank':
                    user.name = `${state} Regional Blood Bank ${i}`;
                    user.email = `bloodbank${i}@test.com`;
                    user.password = 'password';
                    user.licenseNo = `BB${(2000 + i)}`;
                    user.location = `${city}`;
                    break;
            }
            users.push(user as Omit<User, '_id'>);
            userCounter++;
        }
    }
    // Add a banned user
    users.push({ email: 'banned@test.com', password: 'password', role: 'Donor', name: 'Banned User', address: '999 Problem Rd', bloodType: 'B+', mobileNumber: '000-000-0000', city: 'Outcast City', state: 'Rajasthan', country: 'India', status: 'banned' });

    return users;
};

const mockUsers: Omit<User, '_id'>[] = generateUsers();

const generateInventory = (users: Omit<User, '_id'>[]) => {
    const inventory: Omit<BloodUnit, '_id'>[] = [];
    const donationTypes: DonationType[] = ['whole_blood', 'plasma', 'red_blood_cells'];
    const bloodTypes: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    const facilities = users.filter(u => u.role === 'Hospital' || u.role === 'Blood Bank');

    for (const facility of facilities) {
        for (let i = 0; i < 20; i++) {
            const donationType = donationTypes[i % donationTypes.length];
            const collectionDate = subDays(new Date(), Math.floor(Math.random() * 60)); // collected within last 60 days
            
            let expirationDate;
            if (donationType === 'plasma') {
                expirationDate = addDays(collectionDate, 365); // 1 year
            } else { // whole_blood and red_blood_cells
                expirationDate = addDays(collectionDate, 42); // 42 days
            }

            const unit: Omit<BloodUnit, '_id'> = {
                bloodType: bloodTypes[i % bloodTypes.length],
                donationType,
                units: Math.floor(Math.random() * 10) + 1, // 1 to 10 units
                collectionDate: collectionDate.toISOString(),
                expirationDate: expirationDate.toISOString(),
                location: facility.email!,
                locationName: facility.name,
                locationEmail: facility.email,
                locationMobile: facility.mobileNumber,
            };
            inventory.push(unit);
        }
    }
    return inventory;
}

const mockInventory: Omit<BloodUnit, '_id'>[] = generateInventory(mockUsers);


const mockRequests: Omit<BloodRequest, '_id'>[] = [
    { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), bloodType: 'A-', donationType: 'red_blood_cells', units: 2, urgency: 'High', status: 'Pending', requester: 'individual1@test.com' },
    { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), bloodType: 'O+', donationType: 'whole_blood', units: 1, urgency: 'Medium', status: 'In Progress', requester: 'individual2@test.com', responder: 'donor1@test.com' },
];

const mockNotifications: Omit<Notification, '_id'>[] = [
    { type: 'request', requestId: 'req1', recipientEmail: 'donor1@test.com', requesterEmail: 'individual1@test.com', requesterName: 'Individual 1', message: 'New red blood cells request for A- (2 units).', bloodType: 'A-', units: 2, urgency: 'High', date: new Date().toISOString(), read: false },
    { type: 'response', requestId: 'req2', recipientEmail: 'individual2@test.com', requesterEmail: 'donor1@test.com', requesterName: 'Donor 1', message: 'Donor 1 (Donor) has accepted your blood request.', bloodType: 'O+', units: 1, urgency: 'Medium', date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), read: true },
    { type: 'emergency', recipientEmail: 'donor2@test.com', requesterEmail: 'hospital1@test.com', requesterName: 'Mumbai City General Hospital 1', message: 'Emergency broadcast from Mumbai City General Hospital 1: "Critical need for O- blood due to major accident."', bloodType: 'O-', units: 5, urgency: 'Critical', date: new Date(Date.now() - 10 * 60 * 1000).toISOString(), read: false, requestId: 'emergency1' },
];

const mockDonationHistory: Omit<Donation, '_id'>[] = [
    { donorEmail: 'donor1@test.com', date: '2023-08-15T00:00:00.000Z', location: 'Mumbai City General Hospital 1', recipient: 'Mumbai City General Hospital 1', units: 1, bloodType: 'O+' },
];

const mockOffers: Omit<BloodOffer, '_id'>[] = [
    { creatorEmail: 'hospital1@test.com', creatorName: 'Mumbai City General Hospital 1', bloodType: 'A+', donationType: 'whole_blood', units: 5, message: 'Surplus units available.', date: new Date().toISOString(), status: 'Available' },
];

const collectionsToSeed = {
  'users': mockUsers,
  'blood_units': mockInventory,
  'notifications': mockNotifications,
  'blood_requests': mockRequests,
  'donation_history': mockDonationHistory,
  'blood_offers': mockOffers,
};

async function seedDatabase() {
  console.log('Starting database seed process...');
  const client = await clientPromise;
  const db = client.db("blood_net");

  try {
    const collectionNames = Object.keys(collectionsToSeed);
    let shouldSeed = false;

    // Check if any collection is empty
    for (const name of collectionNames) {
        const count = await db.collection(name).countDocuments();
        if (count === 0) {
            console.log(`Collection '${name}' is empty. Seeding is required.`);
            shouldSeed = true;
            break;
        }
    }

    if (!shouldSeed) {
        console.log('All collections have data. Skipping seed process.');
        return;
    }

    // If seeding is required, drop all collections for a clean slate
    console.log('Dropping existing collections for a fresh seed...');
    for (const name of collectionNames) {
        try {
            await db.collection(name).drop();
            console.log(`-> Dropped collection '${name}'.`);
        } catch (err: any) {
            if (err.codeName !== 'NamespaceNotFound') {
                throw err;
            }
        }
    }

    console.log('Inserting mock data into all collections...');
    for (const name in collectionsToSeed) {
        const collection = db.collection(name);
        // @ts-ignore
        const data = collectionsToSeed[name];
        if (data.length > 0) {
            await collection.insertMany(data);
            console.log(`-> Inserted ${data.length} documents into '${name}'.`);
        }
    }

    console.log('Updating inventory summaries for facilities...');
    const facilities = mockUsers.filter(u => u.role === 'Hospital' || u.role === 'Blood Bank');
    for (const facility of facilities) {
        if(facility.email) {
            await updateFacilityInventorySummary(facility.email);
            console.log(`-> Updated inventory for ${facility.name}`);
        }
    }
    
    console.log('\nDatabase seeding complete! ✨');

  } catch (error) {
    console.error('An error occurred during database seeding:', error);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

seedDatabase();
