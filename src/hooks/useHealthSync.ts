import { useEffect, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useHealthKit } from './useHealthKit';

// このセッション（アプリ起動中）ですでに提案したかどうかを管理するフラグ
let hasSuggestedThisSession = false;

export const useHealthSync = () => {
  const appState = useRef(AppState.currentState);
  const { initHealthKit, getTodaySteps, isAvailable } = useHealthKit();
  const router = useRouter();

  const checkAndSuggest = async () => {
    // iOS以外、または既に提案済みの場合は何もしない
    console.log("HealthSync: チェックを開始します...");
    if (!isAvailable || hasSuggestedThisSession) return;

    // 権限初期化
    const hasPermission = await initHealthKit();
    if (!hasPermission) return;

    // 歩数取得
    const currentSteps = await getTodaySteps();

    // 歩数が0より大きければ提案する
    if (currentSteps > 0) {
      hasSuggestedThisSession = true; // フラグを立てて、連続表示を防ぐ

      Alert.alert(
        "今の歩数を記録しますか？",
        `今日はここまで ${currentSteps.toLocaleString()}歩 です。\n記録して「えらい！」をもらいに行きましょう！`,
        [
          { 
            text: "あとで", 
            style: "cancel" 
          },
          { 
            text: "記録する", 
            onPress: () => {
              // 記録画面へ遷移 (パラメータとして歩数を渡す)
              router.push({
                pathname: '/(tabs)/record',
                params: { autoSteps: currentSteps }
              });
            } 
          }
        ]
      );
    }
  };

  useEffect(() => {
    // 1. 初回マウント時（アプリ起動時）にチェック
    checkAndSuggest();

    // 2. バックグラウンドからの復帰を監視
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // バックグラウンドから戻ってきた時もチェック
        checkAndSuggest();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
};