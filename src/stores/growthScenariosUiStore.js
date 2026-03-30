import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const DEFAULT_STATE = {
  cashToDeploy: 0,
  activeTab: 'wealth-growth',
  activePremiumTab: 'wealth-growth',
  includeDepreciation: false,
  annualDepreciationInput: '8000',
  isAdvancedAnalysisOpen: false,
  isAdvancedAssumptionsOpen: false,
  ownershipOverride: null,
  depositStrategy: '20',
  selectedInterestRate: null,
  interestRateInput: '',
  hasHydrated: false,
}

function resolveUpdater(valueOrUpdater, currentValue) {
  return typeof valueOrUpdater === 'function'
    ? valueOrUpdater(currentValue)
    : valueOrUpdater
}

export const useGrowthScenariosUiStore = create(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      setCashToDeploy: (cashToDeploy) =>
        set((state) => ({
          cashToDeploy: resolveUpdater(cashToDeploy, state.cashToDeploy),
        })),
      setActiveTab: (activeTab) =>
        set((state) => ({
          activeTab: resolveUpdater(activeTab, state.activeTab),
        })),
      setActivePremiumTab: (activePremiumTab) =>
        set((state) => ({
          activePremiumTab: resolveUpdater(activePremiumTab, state.activePremiumTab),
        })),
      setIncludeDepreciation: (includeDepreciation) =>
        set((state) => ({
          includeDepreciation: resolveUpdater(
            includeDepreciation,
            state.includeDepreciation
          ),
        })),
      setAnnualDepreciationInput: (annualDepreciationInput) =>
        set((state) => ({
          annualDepreciationInput: resolveUpdater(
            annualDepreciationInput,
            state.annualDepreciationInput
          ),
        })),
      setIsAdvancedAnalysisOpen: (isAdvancedAnalysisOpen) =>
        set((state) => ({
          isAdvancedAnalysisOpen: resolveUpdater(
            isAdvancedAnalysisOpen,
            state.isAdvancedAnalysisOpen
          ),
        })),
      setIsAdvancedAssumptionsOpen: (isAdvancedAssumptionsOpen) =>
        set((state) => ({
          isAdvancedAssumptionsOpen: resolveUpdater(
            isAdvancedAssumptionsOpen,
            state.isAdvancedAssumptionsOpen
          ),
        })),
      setOwnershipOverride: (ownershipOverride) =>
        set((state) => ({
          ownershipOverride: resolveUpdater(ownershipOverride, state.ownershipOverride),
        })),
      setDepositStrategy: (depositStrategy) =>
        set((state) => ({
          depositStrategy: resolveUpdater(depositStrategy, state.depositStrategy),
        })),
      setSelectedInterestRate: (selectedInterestRate) =>
        set((state) => ({
          selectedInterestRate: resolveUpdater(
            selectedInterestRate,
            state.selectedInterestRate
          ),
        })),
      setInterestRateInput: (interestRateInput) =>
        set((state) => ({
          interestRateInput: resolveUpdater(interestRateInput, state.interestRateInput),
        })),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'equifolio-growth-scenarios-ui',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
      partialize: (state) => ({
        cashToDeploy: state.cashToDeploy,
        activeTab: state.activeTab,
        activePremiumTab: state.activePremiumTab,
        includeDepreciation: state.includeDepreciation,
        annualDepreciationInput: state.annualDepreciationInput,
        isAdvancedAnalysisOpen: state.isAdvancedAnalysisOpen,
        isAdvancedAssumptionsOpen: state.isAdvancedAssumptionsOpen,
        ownershipOverride: state.ownershipOverride,
        depositStrategy: state.depositStrategy,
        selectedInterestRate: state.selectedInterestRate,
        interestRateInput: state.interestRateInput,
      }),
    }
  )
)
