











export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type Urgency = 'Low' | 'Medium' | 'High' | 'Critical';
export type Gender = 'Male' | 'Female' | 'Other' | 'Prefer not to say';
export type DonationStatus = 'Eligible' | 'Not Eligible' | 'Pending';
export type RequestStatus = 'Fulfilled' | 'Pending' | 'In Progress' | 'Declined' | 'Matched' | 'Expired';
export type OfferStatus = 'Available' | 'Claimed' | 'Cancelled';
export type UserStatus = 'active' | 'banned';
export type DonationType = 'whole_blood' | 'plasma' | 'red_blood_cells';

// --- Base User & Entity Interfaces ---

interface BaseUser {
  _id: string;
  name: string;
  email: string;
  contactInfo: string;
  // Password is not stored in the model, it's handled by authentication.
}

interface MedicalInfo {
  bloodType: BloodType;
  // Medical reports can be a URL or reference to a storage service
  medicalReports: string[];
}

// --- Roles ---

export interface Donor extends BaseUser, MedicalInfo {
  donorId: string; // Unique Donor ID
  abhaId: string;
  age: number;
  gender: Gender;
  donationHistory: Donation[];
  eligibilityStatus: DonationStatus;
}

export interface Individual extends BaseUser {
  patientId: string; // ABHA ID
  requestHistory: BloodRequest[];
  bloodReceivedHistory: BloodReceived[];
}

export interface Hospital {
  _id: string; // Unique Hospital ID
  name: string;
  licenseNumber: string;
  address: string;
  location: string; // Could be GeoPoint or string coordinates
  contactInfo: string;
  inventory: BloodUnit[];
  requestHistory: BloodRequest[];
}

export interface BloodBank {
  _id: string; // Unique Blood Bank ID
  name: string;
  licenseNumber: string;
  address: string;
  location: string;
  contactInfo: string;
  inventory: BloodUnit[];
  distributionHistory: Donation[]; // History of units sent to hospitals
}


// --- Data Models ---

export type BloodUnit = {
  _id: string;
  bloodType: BloodType;
  donationType: DonationType;
  units: number;
  collectionDate: string; // ISO string
  expirationDate: string; // ISO string
  storageConditions?: string;
  location: string; // This will store the hospital's email
  locationName?: string;
  locationEmail?: string;
  locationMobile?: string;
};

export type Donation = {
  _id: string; // Unique donation transaction ID
  donorEmail: string;
  date: string; // ISO string
  location: string; // Where the donation took place
  recipient: string; // Recipient entity ID (Hospital or Blood Bank)
  units: number;
  bloodType: BloodType;
};

export type BloodRequest = {
  _id: string;
  date: string; // Should be ISO string
  bloodType: BloodType;
  donationType: DonationType;
  units: number;
  urgency: Urgency;
  status: RequestStatus;
  requester?: string; // ID of the individual or hospital
  responder?: string;
  emergency?: boolean; // Flag for emergency broadcasts
};

export type BloodReceived = {
  _id:string;
  date: string; // ISO string
  bloodType: BloodType;
  units: number;
  hospitalId: string;
};

export type Redistribution = {
  _id: string;
  date: string; // ISO string
  source: string;
  destination: string;
  units: number;
  bloodType: BloodType;
};

export type Transfer = {
  _id: string;
  date: string; // ISO string
  source: string;
  destination: string;
  units: number;
  bloodType: BloodType;
  donationType: DonationType;
};

export type BloodOffer = {
    _id: string;
    creatorEmail: string;
    creatorName: string;
    bloodType: BloodType;
    donationType: DonationType;
    units: number;
    message: string;
    date: string; // ISO string
    status: OfferStatus;
    claimedByEmail?: string;
    claimedByName?: string;
};


export type Notification = {
  _id: string;
  type: 'request' | 'response' | 'decline' | 'info' | 'offer' | 'claim' | 'emergency';
  requestId?: string;
  offerId?: string;
  recipientEmail: string;
  requesterEmail: string;
  requesterName?: string;
  requesterMobileNumber?: string;
  message: string;
  bloodType: string;
  units: number;
  urgency: Urgency;
  date: string; // ISO string
  read: boolean;
};

    
