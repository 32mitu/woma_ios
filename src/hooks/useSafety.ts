import { useState } from 'react';
import { doc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../features/auth/useAuth';
import { Alert } from 'react-native';

export const useSafety = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  // 通報機能
  const reportContent = async (targetId: string, type: 'post' | 'user' | 'dm', reason: string = 'Inappropriate content') => {
    if (!userProfile?.uid) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: userProfile.uid,
        targetId,
        type,
        reason,
        createdAt: serverTimestamp(),
      });
      console.log(`✅ [Report] ${type} reported: ${targetId}`);
      Alert.alert("報告ありがとうございます", "運営チームが内容を確認し、適切に対処いたします。");
    } catch (e) {
      console.error("Report failed:", e);
      Alert.alert("エラー", "報告の送信に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // ブロック機能
  const blockUser = async (targetUserId: string) => {
    if (!userProfile?.uid) return;
    
    Alert.alert(
      "ユーザーをブロック",
      "このユーザーの投稿が表示されなくなります。本当にブロックしますか？",
      [
        { text: "キャンセル", style: "cancel" },
        { 
          text: "ブロックする", 
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              console.log(`🚫 [Block] Blocking user: ${targetUserId}`);
              const userRef = doc(db, 'users', userProfile.uid);
              
              // Firestore配列への追加
              await updateDoc(userRef, {
                blockedUsers: arrayUnion(targetUserId)
              });
              
              console.log("✅ [Block] Success. Firestore updated.");
              Alert.alert("完了", "ブロックしました。");
            } catch (e) {
              console.error("Block failed:", e);
              Alert.alert("エラー", "ブロックに失敗しました。");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return { reportContent, blockUser, loading };
};