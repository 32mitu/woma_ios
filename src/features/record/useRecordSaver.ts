import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../../../firebaseConfig';
import { useRouter } from 'expo-router';

export const useRecordSaver = () => {
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const saveRecord = async (
    data: {
      activities: any[];
      weight: string;
      comment: string;
      imageUris: string[];
      postToTimeline: boolean;
    }
  ) => {
    if (!auth.currentUser) return;
    setSaving(true);

    try {
      const { activities, weight, comment, imageUris, postToTimeline } = data;
      const uid = auth.currentUser.uid;

      // 1. 画像アップロード処理 (複数対応)
      let uploadedImageUrls: string[] = [];
      
      if (imageUris.length > 0) {
        const uploadPromises = imageUris.map(async (uri, index) => {
          const response = await fetch(uri);
          const blob = await response.blob();
          
          // ファイル名をユニークにする
          const filename = `records/${uid}/${Date.now()}_${index}.jpg`;
          const storageRef = ref(storage, filename);
          
          await uploadBytes(storageRef, blob);
          return await getDownloadURL(storageRef);
        });

        uploadedImageUrls = await Promise.all(uploadPromises);
      }

      // 2. アクティビティデータの整形
      const sanitizedActivities = activities.map((act) => ({
        name: act.name,
        type: act.type || 'other',
        intensity: act.intensity || '中',
        duration: Number(act.duration) || 0,
        steps: Number(act.steps) || 0, // ★ ここで歩数を保存
        mets: Number(act.mets) || 0,
        baseMets: {
          low: Number(act.baseMets?.low) || 0,
          mid: Number(act.baseMets?.mid) || 0,
          high: Number(act.baseMets?.high) || 0,
        }
      }));

      // 3. 基本データの作成
      const recordData = {
        uid, // セキュリティルールで必須
        activities: sanitizedActivities,
        weight: weight ? Number(weight) : null,
        comment: comment || '',
        imageUrls: uploadedImageUrls, // 配列として保存
        imageUrl: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : null, // 後方互換性
        createdAt: serverTimestamp(),
      };

      // 4. records コレクションに保存
      const docRef = await addDoc(collection(db, 'records'), recordData);

      // 5. タイムラインへの投稿 (ONの場合)
      if (postToTimeline) {
        await addDoc(collection(db, 'timeline'), {
          ...recordData,
          recordId: docRef.id,
          username: auth.currentUser.displayName || 'ユーザー',
          userIcon: auth.currentUser.photoURL || null,
          likes: 0,
          comments: 0,
          type: 'record',
        });
      }

      console.log('Record saved successfully!');
    } catch (error) {
      console.error('Error saving record:', error);
      alert('保存に失敗しました。もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  };

  return { saveRecord, saving };
};