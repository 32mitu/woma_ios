import { useState, useCallback, useEffect } from 'react';
import { 
  collection, addDoc, orderBy, query, onSnapshot, 
  doc, setDoc, serverTimestamp, increment, getDoc 
} from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../../firebaseConfig';
import { IMessage } from 'react-native-gifted-chat';

export const useChat = (currentUserId?: string, partnerUserId?: string) => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  // 1. ルームID作成 (UIDをソートして結合)
  useEffect(() => {
    if (!currentUserId || !partnerUserId) return;
    const ids = [currentUserId, partnerUserId].sort();
    setRoomId(`${ids[0]}_${ids[1]}`);
  }, [currentUserId, partnerUserId]);

  // 2. メッセージ受信 (リアルタイム)
  useEffect(() => {
    if (!roomId) return;

    const messagesRef = collection(db, 'chatRooms', roomId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        // Firestore Timestamp を Date に変換
        const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        
        return {
          _id: doc.id,
          text: data.text || '',
          createdAt: date,
          user: data.user,
          image: data.image || null, // 画像URLがあればセット
        } as IMessage;
      });
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [roomId]);

  // 共通: メッセージ送信の内部ロジック
  const sendMessageRaw = async (text: string, imageUri: string | null, user: any) => {
    if (!roomId || !currentUserId || !partnerUserId) return;

    try {
      let downloadUrl = null;

      // 画像がある場合はStorageにアップロード
      if (imageUri) {
        // パス: chat-images/ルームID/タイムスタンプ.jpg
        const filename = `chat-images/${roomId}/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        
        const response = await fetch(imageUri);
        const blob = await response.blob();
        
        await uploadBytes(storageRef, blob);
        downloadUrl = await getDownloadURL(storageRef);
      }

      // 何も送るものがない場合は終了
      if (!text && !downloadUrl) return;

      // メッセージデータの作成
      const msgData: any = {
        text: text,
        createdAt: serverTimestamp(),
        senderId: currentUserId,
        user: {
          _id: currentUserId,
          name: user.name || 'Unknown',
          avatar: user.avatar || null 
        },
        read: false
      };

      if (downloadUrl) {
        msgData.image = downloadUrl;
      }

      // (1) メッセージ追加
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), msgData);

      // (2) ルーム情報の更新 (一覧表示用)
      let lastMsgText = text;
      if (!text && downloadUrl) lastMsgText = '📷 画像を送信しました';

      const roomRef = doc(db, 'chatRooms', roomId);
      
      await setDoc(roomRef, {
        members: [currentUserId, partnerUserId].sort(),
        lastMessage: lastMsgText,
        updatedAt: serverTimestamp(),
        // 相手の未読数をインクリメント
        [`unreadCounts.${partnerUserId}`]: increment(1),
        
        // 自分のメンバー情報を更新(キャッシュ)
        [`memberInfo.${currentUserId}`]: {
          name: user.name || 'Unknown',
          avatar: user.avatar || null
        }
      }, { merge: true });

    } catch (error) {
      console.error("送信エラー:", error);
      throw error;
    }
  };

  // 3. テキスト送信 (GiftedChatのonSend用)
  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    if (newMessages.length === 0) return;
    const msg = newMessages[0];
    await sendMessageRaw(msg.text, null, msg.user);
  }, [roomId, currentUserId, partnerUserId]);

  // 4. 画像送信 (UIから呼び出し用)
  const sendImage = useCallback(async (imageUri: string, user: any) => {
    await sendMessageRaw('', imageUri, user);
  }, [roomId, currentUserId, partnerUserId]);

  // 5. 既読処理
  const markAsRead = useCallback(async () => {
    if (!roomId || !currentUserId) return;
    // 自分の未読カウントを0にリセット
    const roomRef = doc(db, 'chatRooms', roomId);
    await setDoc(roomRef, {
      [`unreadCounts.${currentUserId}`]: 0
    }, { merge: true });
  }, [roomId, currentUserId]);

  return { messages, onSend, sendImage, markAsRead };
};