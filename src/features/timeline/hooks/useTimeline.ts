import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { useAuth } from '../../auth/useAuth';

export const useTimeline = (groupId?: string) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth(); // 自分のプロフィール（ブロックリスト含む）

  useEffect(() => {
    // 1. ブロックリストの確認ログ
    const blockedUsers = userProfile?.blockedUsers || [];
    console.log("🚫 [useTimeline] Current Block List:", blockedUsers);

    let q;
    const timelineRef = collection(db, "timeline");

    if (groupId) {
      q = query(timelineRef, where("groupId", "==", groupId), orderBy("createdAt", "desc"), limit(50));
    } else {
      q = query(timelineRef, orderBy("createdAt", "desc"), limit(50));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // 2. 全取得
      const allPosts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        };
      });

      // 3. フィルタリング実行 & ログ確認
      const filteredPosts = allPosts.filter(post => {
        // 投稿にuserIdがない、またはブロックリストに含まれていなければ表示
        const isBlocked = post.userId && blockedUsers.includes(post.userId);
        if (isBlocked) {
          console.log(`👻 [Filter] Hiding post ${post.id} from blocked user ${post.userId}`);
        }
        return !isBlocked;
      });

      setPosts(filteredPosts);
      setLoading(false);
    }, (error) => {
      console.error("タイムライン取得エラー:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId, userProfile?.blockedUsers]); // ★ここが重要: ブロックリストが変わったら再実行

  return { posts, loading };
};