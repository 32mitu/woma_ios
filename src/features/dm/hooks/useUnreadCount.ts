import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { useAuth } from '../../auth/useAuth';

export const useUnreadCount = () => {
  const { userProfile } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!userProfile?.uid) {
      setTotalUnread(0);
      return;
    }

    const q = query(
      collection(db, 'chatRooms'),
      where('members', 'array-contains', userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const roomUnread = data.unreadCounts?.[userProfile.uid] || 0;
        if (typeof roomUnread === 'number') {
          count += roomUnread;
        }
      });
      setTotalUnread(count);
    });

    return () => unsubscribe();
  }, [userProfile?.uid]);

  return totalUnread;
};