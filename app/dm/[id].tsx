import React, { useState, useEffect } from 'react';
import { 
  View, ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Text, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import { useAuth } from '../../src/features/auth/useAuth';
import { useChat } from '../../src/features/dm/hooks/useChat';
import { useSafety } from '../../src/hooks/useSafety';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; // ★追加

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams();
  const partnerId = Array.isArray(id) ? id[0] : id;
  const { userProfile } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const { reportContent, blockUser } = useSafety();
  
  const [inputText, setInputText] = useState('');
  const { messages, onSend, markAsRead } = useChat(userProfile?.uid, partnerId);
  const [partnerName, setPartnerName] = useState('チャット'); // ヘッダー用

  // ヘッダー設定 (通報ブロックメニュー)
  useEffect(() => {
    navigation.setOptions({
      title: partnerName,
      headerRight: () => (
        <TouchableOpacity onPress={handleMenu} style={{ marginRight: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, partnerName]);

  // メニューアクション
  const handleMenu = () => {
    Alert.alert(
      "メニュー",
      "",
      [
        { text: "通報する", onPress: () => handleReport(), style: "destructive" },
        { text: "ブロックする", onPress: () => handleBlock(), style: "destructive" },
        { text: "キャンセル", style: "cancel" }
      ]
    );
  };

  const handleReport = async () => {
    await reportContent("dm_room", partnerId, "DM user report");
    Alert.alert("通報しました", "運営が内容を確認します。");
  };

  const handleBlock = async () => {
    await blockUser(partnerId);
    Alert.alert("ブロックしました", "ホームに戻ります。");
    router.replace('/(tabs)/home');
  };

  // 既読処理
  useEffect(() => {
    markAsRead();
  }, [messages]);

  // ★画像選択
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // チャットなのでトリミングなしでサクサク送る
      quality: 0.7,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      // 画像送信用のメッセージオブジェクトを作成
      const msg: IMessage = {
        _id: Date.now().toString(),
        text: '',
        createdAt: new Date(),
        user: {
          _id: userProfile?.uid || 'guest',
          name: userProfile?.username || 'Guest',
          avatar: userProfile?.iconUrl,
        },
        image: asset.uri, // ★ローカルURIをセット
      };
      onSend([msg]);
    }
  };

  // テキスト送信
  const handleSendRaw = () => {
    if (!inputText.trim()) return;
    
    const msg: IMessage = {
      _id: Date.now().toString(),
      text: inputText.trim(),
      createdAt: new Date(),
      user: {
        _id: userProfile?.uid || 'guest',
        name: userProfile?.username || 'Guest',
        avatar: userProfile?.iconUrl,
      }
    };
    onSend([msg]);
    setInputText('');
  };

  if (!userProfile) return <View style={styles.loadingContainer}><ActivityIndicator /></View>;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.chatContainer}>
          <GiftedChat
            messages={messages}
            onSend={(messages) => onSend(messages)}
            user={{ _id: userProfile?.uid || '' }}
            renderInputToolbar={() => null} // デフォルトの入力バーを非表示
            minInputToolbarHeight={0}
            alwaysShowSend
            scrollToBottom
            // 画像タップで拡大表示するための設定 (必要に応じてライブラリ追加)
            // renderMessageImage={(props) => ...} 
          />
        </View>

        {/* カスタム入力バー */}
        <View style={styles.inputBar}>
          {/* ★画像送信ボタン */}
          <TouchableOpacity onPress={pickImage} style={styles.iconButton}>
            <Ionicons name="image-outline" size={26} color="#3B82F6" />
          </TouchableOpacity>

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
  iconButton: {
    marginRight: 10,
    marginBottom: 10, // テキスト入力欄の下揃えに合わせる
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
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});


