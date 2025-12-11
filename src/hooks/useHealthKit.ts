import AppleHealthKit, { HealthValue, HealthKitPermissions } from 'react-native-health';
import { Platform } from 'react-native';

const permissions: HealthKitPermissions = {
  permissions: {
    read: [AppleHealthKit.Constants.Permissions.Steps],
    write: [],
  },
};

export const useHealthKit = () => {
  const isAvailable = Platform.OS === 'ios';

  // 1. 初期化・権限リクエスト
  const initHealthKit = async (): Promise<boolean> => {
    if (!isAvailable) return false;
    
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          console.log('[HealthKit] Error:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  };

  // 2. 今日の歩数を取得
  const getTodaySteps = async (): Promise<number> => {
    if (!isAvailable) return 0;

    return new Promise((resolve) => {
      const options = {
        includeManuallyAdded: true, // 手入力も含む
      };
      
      AppleHealthKit.getStepCount(options, (err: string, results: HealthValue) => {
        if (err) {
          console.log('[HealthKit] Step Count Error:', err);
          resolve(0);
          return;
        }
        resolve(results.value);
      });
    });
  };

  return { initHealthKit, getTodaySteps, isAvailable };
};