import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';

export const usePushNotifications = (userId?: string) => {
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      // ログ削除
      setExpoPushToken(token);
      if (userId && token) {
        saveTokenToFirestore(userId, token);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // ログ削除
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'dm' && data?.partnerId) {
        router.push(`/dm/${data.partnerId}`);
      } else if (data?.type === 'like' || data?.type === 'comment') {
        router.push('/(tabs)/home'); 
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);

  const saveTokenToFirestore = async (uid: string, token: string) => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token)
      });
    } catch (error) {
      // エラーログは残しておいたほうが安全ですが、邪魔ならここも消せます
      console.error("Error saving token:", error);
    }
  };

  const scheduleDailyReminder = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "今日の記録はまだですか？",
        body: "5分だけ歩きませんか？記録して自分を肯定しましょう！",
        sound: 'default',
      },
      trigger: {
        hour: 20,
        minute: 0,
        repeats: true,
      } as any,
    });
  };

  return { expoPushToken, notification, scheduleDailyReminder };
};

async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return;
    }
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } else {
    // シミュレーターの場合は静かに終了（ログ削除）
  }

  return token;
}