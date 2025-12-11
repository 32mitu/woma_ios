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

  // 1. ルームID作成
  useEffect(() => {
    if (!currentUserId || !partnerUserId) return;
    const ids = [currentUserId, partnerUserId].sort();
    setRoomId(`${ids[0]}_${ids[1]}`);
  }, [currentUserId, partnerUserId]);

  // 2. メッセージ受信
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
          text: data.text,
          createdAt: date,
          user: data.user,
          image: data.image || null,
        } as IMessage;
      });
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [roomId]);

  // 3. 送信処理 (画像アップロード対応 & undefined対策)
  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    if (!roomId || !currentUserId || !partnerUserId) return;

    const message = newMessages[0];
    const { _id, text, user, image } = message;

    try {
      let downloadUrl = null;

      // 画像がある場合、Storageにアップロード
      if (image) {
        // file:// から始まるローカルURIの場合のみアップロード
        const response = await fetch(image);
        const blob = await response.blob();
        const filename = `chat_images/${roomId}/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        
        await uploadBytes(storageRef, blob);
        downloadUrl = await getDownloadURL(storageRef);
      }

      // (1) メッセージ保存
      const msgData: any = {
        _id,
        text: text || '',
        createdAt: serverTimestamp(),
        // ★修正: userオブジェクト内の undefined を null に変換 (Firestore対策)
        user: {
          _id: user._id,
          name: user.name || 'Unknown',
          avatar: user.avatar || null // ここで undefined を防ぐ
        },
        senderId: currentUserId
      };
      
      // 画像URLがあれば保存
      if (downloadUrl) {
        msgData.image = downloadUrl;
      }

      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), msgData);

      // (2) ルーム情報更新
      let lastMsgText = text;
      if (!text && downloadUrl) lastMsgText = '📷 画像を送信しました';

      const roomRef = doc(db, 'chatRooms', roomId);
      
      // 自分の最新情報をキャッシュしつつ更新
      await setDoc(roomRef, {
        members: [currentUserId, partnerUserId].sort(),
        lastMessage: lastMsgText,
        updatedAt: serverTimestamp(),
        [`unreadCounts.${partnerUserId}`]: increment(1),
        
        // 自分のメンバー情報を更新(キャッシュ)
        [`memberInfo.${currentUserId}`]: {
          name: user.name || 'Unknown',
          avatar: user.avatar || null // ここも同様に undefined を防ぐ
        }
      }, { merge: true });

    } catch (error) {
      console.error("送信エラー:", error);
    }
  }, [roomId, currentUserId, partnerUserId]);

  // 4. 既読処理
  const markAsRead = useCallback(async () => {
    if (!roomId || !currentUserId) return;
    
    const roomRef = doc(db, 'chatRooms', roomId);
    try {
      await setDoc(roomRef, {
        [`unreadCounts.${currentUserId}`]: 0
      }, { merge: true });
    } catch (e) {
      console.log("既読更新エラー:", e);
    }
  }, [roomId, currentUserId]);

  return {
    messages,
    onSend,
    markAsRead
  };
};