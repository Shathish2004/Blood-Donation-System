import type { BloodUnit, Donation, BloodRequest, Redistribution, BloodType, DonationType } from './types';

const today = new Date();
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const bloodTypes: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const donationTypes: DonationType[] = ['whole_blood', 'plasma', 'red_blood_cells'];
