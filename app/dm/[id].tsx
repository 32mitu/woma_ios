import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, StyleSheet, Alert, TouchableOpacity, Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { GiftedChat, Actions, IMessage } from 'react-native-gifted-chat';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import { useAuth } from '../../src/features/auth/useAuth';
import { useChat } from '../../src/features/dm/hooks/useChat';
import { useSafety } from '../../src/hooks/useSafety';

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams();
  const partnerId = Array.isArray(id) ? id[0] : id;
  const { userProfile } = useAuth();
  const navigation = useNavigation();
  
  // hooks
  const { messages, onSend, sendImage, markAsRead } = useChat(userProfile?.uid, partnerId);
  const { reportContent, blockUser } = useSafety();

  const [partnerName, setPartnerName] = useState('チャット');

  // 相手の名前を取得
  useEffect(() => {
    const fetchPartnerProfile = async () => {
      if (partnerId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', partnerId));
          if (userDoc.exists()) {
            setPartnerName(userDoc.data().username || '名無しさん');
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
    fetchPartnerProfile();
  }, [partnerId]);

  // ヘッダー設定 (通報・ブロックメニュー)
  useEffect(() => {
    navigation.setOptions({
      title: partnerName,
      headerRight: () => (
        <TouchableOpacity 
          onPress={showActionSheet} 
          style={{ padding: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, partnerName]);

  // 画面表示時に既読にする
  useEffect(() => {
    markAsRead();
  }, [messages.length]); // メッセージが増えるたびに既読チェック

  // アクションシート表示
  const showActionSheet = () => {
    Alert.alert(
      'メニュー',
      '操作を選択してください',
      [
        { 
          text: 'このユーザーを通報', 
          onPress: () => handleReport(),
          style: 'destructive' 
        },
        { 
          text: 'このユーザーをブロック', 
          onPress: () => handleBlock(),
          style: 'destructive' 
        },
        { text: 'キャンセル', style: 'cancel' }
      ]
    );
  };

  const handleReport = async () => {
    if (!partnerId) return;
    await reportContent('user' as const, partnerId, '不適切なDM');
    Alert.alert('完了', '通報を受け付けました。');
  };

  const handleBlock = async () => {
    if (!partnerId) return;
    await blockUser(partnerId);
    Alert.alert('完了', 'ユーザーをブロックしました。');
    navigation.goBack();
  };

  // ★画像選択処理
  const handlePickImage = useCallback(async () => {
    if (!userProfile) return;

    // 権限確認 (必要に応じて)
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted === false) {
      Alert.alert('エラー', '写真へのアクセス許可が必要です');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      
      // 送信実行
      const user = {
        _id: userProfile.uid,
        name: userProfile.username,
        avatar: userProfile.profileImageUrl
      };
      await sendImage(uri, user);
    }
  }, [userProfile, sendImage]);

  // ★入力欄左側の「＋」ボタン描画
  const renderActions = useCallback((props: any) => {
    return (
      <Actions
        {...props}
        containerStyle={{
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 0,
        }}
        icon={() => (
          <Ionicons name="image" size={28} color="#3B82F6" />
        )}
        onPressActionButton={handlePickImage}
      />
    );
  }, [handlePickImage]);

  // ユーザー情報オブジェクト (GiftedChat用)
  const currentUser = {
    _id: userProfile?.uid || '',
    name: userProfile?.username || '自分',
    avatar: userProfile?.profileImageUrl || undefined,
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        user={currentUser}
        renderUsernameOnMessage={false}
        alwaysShowSend
        renderActions={renderActions} // 画像ボタンを追加
        placeholder="メッセージを入力..."
        textInputProps={{
          style: styles.textInput
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  textInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
    marginLeft: 0,
    marginRight: 10,
    paddingTop: 8,
    fontSize: 16,
    lineHeight: 20,
  },
});