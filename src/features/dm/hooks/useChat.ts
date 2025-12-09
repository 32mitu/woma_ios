import { useState, useCallback, useEffect } from 'react';
import { 
  collection, addDoc, orderBy, query, onSnapshot, 
  doc, setDoc, serverTimestamp, increment, getDoc 
} from 'firebase/firestore'; 
import { db } from '../../../../firebaseConfig';
import { IMessage } from 'react-native-gifted-chat';

export const useChat = (currentUserId?: string, partnerUserId?: string) => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  // 1. ルームID作成
  useEffect(() => {
    if (!currentUserId || !partnerUserId) return;
    const ids = [currentUserId, partnerUserId].sort();
    setRoomId(`${ids[0]}_${ids[1]}`);
  }, [currentUserId, partnerUserId]);

  // 2. メッセージ受信 (画像対応)
  useEffect(() => {
    if (!roomId) return;

    const messagesRef = collection(db, 'chatRooms', roomId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        
        return {
          _id: doc.id,
          text: data.text || '',
          createdAt: date,
          user: data.user || { _id: 'unknown', name: 'Unknown' },
          image: data.image || null,
        } as IMessage;
      });
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [roomId]);

  // 3. 送信処理 (ここを修正！)
  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    if (!roomId || !currentUserId || !partnerUserId) return;

    const { _id, text, user, image } = newMessages[0];

    try {
      // (1) メッセージ保存
      const msgData: any = {
        _id,
        text: text || '',
        createdAt: serverTimestamp(),
        user,
        senderId: currentUserId
      };
      if (image) msgData.image = image;

      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), msgData);

      // (2) ルーム情報更新
      let lastMsgText = text;
      if (!text && image) lastMsgText = '📷 画像を送信しました';

      const roomRef = doc(db, 'chatRooms', roomId);
      
      // ★修正ポイント: ドット記法をやめ、ネストしたオブジェクトで渡す
      await setDoc(roomRef, {
        members: [currentUserId, partnerUserId].sort(),
        lastMessage: lastMsgText,
        updatedAt: serverTimestamp(),
        // ここを変更！
        unreadCounts: {
          [partnerUserId]: increment(1)
        }
      }, { merge: true });

    } catch (error) {
      console.error("送信エラー:", error);
    }
  }, [roomId, currentUserId, partnerUserId]);

  // 4. 既読処理 (ここも修正！)
  const markAsRead = useCallback(async () => {
    if (!roomId || !currentUserId) return;
    try {
      const roomRef = doc(db, 'chatRooms', roomId);
      // ★修正ポイント
      await setDoc(roomRef, {
        unreadCounts: {
          [currentUserId]: 0
        }
      }, { merge: true });
    } catch (error) {
      console.error("既読処理エラー:", error);
    }
  }, [roomId, currentUserId]);

  return { messages, onSend, roomId, markAsRead };
};

