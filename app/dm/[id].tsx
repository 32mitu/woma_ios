import React, { useState, useEffect } from 'react';
import { 
  View, ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Text, Alert, ActionSheetIOS 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'; // useRouter追加
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../src/features/auth/useAuth';
import { useChat } from '../../src/features/dm/hooks/useChat';
import { useSafety } from '../../src/hooks/useSafety'; // ★追加
import { Ionicons } from '@expo/vector-icons';

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams();
  const partnerId = Array.isArray(id) ? id[0] : id;
  const { userProfile } = useAuth();
  const navigation = useNavigation();
  const router = useRouter(); // ★追加
  const { reportContent, blockUser } = useSafety(); // ★追加
  
  const [inputText, setInputText] = useState('');
  const { messages, onSend, markAsRead } = useChat(userProfile?.uid, partnerId);

  // 相手情報の取得 ＆ ヘッダーメニュー設定
  useEffect(() => {
    const fetchPartnerName = async () => {
      if (!partnerId) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', partnerId));
        if (userDoc.exists()) {
          const name = userDoc.data().username || 'チャット';
          
          // ★ヘッダーにメニューボタンを追加
          navigation.setOptions({ 
            title: name,
            headerRight: () => (
              <TouchableOpacity onPress={showMenu} style={{ marginRight: 8 }}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
              </TouchableOpacity>
            )
          });
        }
      } catch (e) { console.log(e); }
    };
    fetchPartnerName();
  }, [partnerId]);

  // ★安全対策メニュー
  const showMenu = () => {
    if (!partnerId) return;
    const options = ['キャンセル', '通報する', 'ブロックする'];
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: 2 },
        (index) => handleMenuAction(index)
      );
    } else {
      Alert.alert("メニュー", "", [
        { text: 'キャンセル', style: 'cancel' },
        { text: '通報する', onPress: () => handleMenuAction(1) },
        { text: 'ブロックする', onPress: () => handleMenuAction(2) },
      ]);
    }
  };

  const handleMenuAction = (index: number) => {
    if (index === 1) { // 通報
      reportContent(partnerId, 'user');
    } else if (index === 2) { // ブロック
      blockUser(partnerId).then(() => {
        // ブロックしたら一覧に戻る
        router.back();
      });
    }
  };

  // 既読処理
  useEffect(() => {
    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages.length]);

  // 自作の送信処理
  const handleSendRaw = () => {
    if (!inputText.trim() || !userProfile?.uid) return;

    // もしブロックリストに含まれていたら送信させない等の制御も可能ですが
    // 一旦標準の実装のみ行います
    const newMessage: IMessage = {
      _id: Math.random().toString(36).substring(7),
      text: inputText.trim(),
      createdAt: new Date(),
      user: {
        _id: userProfile.uid,
        name: userProfile.username || '自分',
      }
    };

    onSend([newMessage]); 
    setInputText('');     
  };

  if (!userProfile?.uid || !partnerId) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.chatContainer}>
          <GiftedChat
            messages={messages}
            user={{
              _id: userProfile.uid,
            }}
            renderInputToolbar={() => null}
            minInputToolbarHeight={0}
            alwaysShowSend={false}
            scrollToBottom
            locale='ja'
          />
        </View>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="メッセージを入力..."
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]} 
            onPress={handleSendRaw}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  chatContainer: { flex: 1 },
  
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 10,
    fontSize: 16,
    color: '#333',
    maxHeight: 100, 
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});