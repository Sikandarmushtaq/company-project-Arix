/**
 * Signup Wizard Store
 */

import { create } from 'zustand';

interface SelectedNumber {
  phoneNumber: string;
  countryCode: string;
  region?: string;
  locality?: string;
  numberType: string;
  monthlyCostCents: number;
  upfrontCostCents: number;
}

interface SignupStore {
  step: number;
  token: string | null;
  selectedNumbers: SelectedNumber[];
  smsCampaignRequested: boolean;
  setStep: (step: number) => void;
  setToken: (token: string) => void;
  setSelectedNumbers: (numbers: SelectedNumber[]) => void;
  toggleNumber: (number: SelectedNumber) => void;
  setSmsCampaignRequested: (requested: boolean) => void;
  reset: () => void;
}

export const useSignupStore = create<SignupStore>((set, get) => ({
  step: 1,
  token: null,
  selectedNumbers: [],
  smsCampaignRequested: false,

  setStep: (step) => set({ step }),
  setToken: (token) => set({ token }),
  setSelectedNumbers: (numbers) => set({ selectedNumbers: numbers }),

  toggleNumber: (number) => {
    const current = get().selectedNumbers;
    const exists = current.find((n) => n.phoneNumber === number.phoneNumber);
    if (exists) {
      set({ selectedNumbers: current.filter((n) => n.phoneNumber !== number.phoneNumber) });
    } else {
      set({ selectedNumbers: [...current, number] });
    }
  },

  setSmsCampaignRequested: (requested) => set({ smsCampaignRequested: requested }),

  reset: () =>
    set({
      step: 1,
      token: null,
      selectedNumbers: [],
      smsCampaignRequested: false,
    }),
}));
