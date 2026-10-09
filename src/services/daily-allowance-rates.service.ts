import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAILY_ALLOWANCE_RATES, DailyAllowanceRates } from '../types/company';

const DAILY_ALLOWANCE_RATES_STORAGE_KEY = '@payment_app_daily_allowance_rates';

export class DailyAllowanceRatesService {
  /**
   * Returns the stored DA rates, or defaults to ₹400 travel and ₹600 food.
   */
  static async getRates(): Promise<DailyAllowanceRates> {
    try {
      const stored = await AsyncStorage.getItem(DAILY_ALLOWANCE_RATES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          typeof parsed?.TRAVEL_ALLOWANCE_PAISE === 'number' &&
          typeof parsed?.FOOD_ALLOWANCE_PAISE === 'number' &&
          parsed.TRAVEL_ALLOWANCE_PAISE > 0 &&
          parsed.FOOD_ALLOWANCE_PAISE > 0
        ) {
          return {
            TRAVEL_ALLOWANCE_PAISE: parsed.TRAVEL_ALLOWANCE_PAISE,
            FOOD_ALLOWANCE_PAISE: parsed.FOOD_ALLOWANCE_PAISE,
            TOTAL_ALLOWANCE_PAISE:
              parsed.TRAVEL_ALLOWANCE_PAISE + parsed.FOOD_ALLOWANCE_PAISE,
          };
        }
      }
    } catch (error) {
      console.error('Failed to read daily allowance rates from storage:', error);
    }

    return DAILY_ALLOWANCE_RATES;
  }

  /**
   * Save customized daily allowance rates in paise.
   */
  static async setRates(
    travelPaise: number,
    foodPaise: number,
  ): Promise<DailyAllowanceRates> {
    if (travelPaise <= 0 || foodPaise <= 0) {
      throw new Error('Allowance rates must be greater than zero.');
    }

    const rates: DailyAllowanceRates = {
      TRAVEL_ALLOWANCE_PAISE: Math.round(travelPaise),
      FOOD_ALLOWANCE_PAISE: Math.round(foodPaise),
      TOTAL_ALLOWANCE_PAISE: Math.round(travelPaise + foodPaise),
    };

    await AsyncStorage.setItem(
      DAILY_ALLOWANCE_RATES_STORAGE_KEY,
      JSON.stringify(rates),
    );

    return rates;
  }

  /**
   * Reset rates back to default ₹400 travel and ₹600 food.
   */
  static async resetToDefaults(): Promise<DailyAllowanceRates> {
    await AsyncStorage.removeItem(DAILY_ALLOWANCE_RATES_STORAGE_KEY);
    return DAILY_ALLOWANCE_RATES;
  }
}
