import { useState } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, serverTimestamp, doc, writeBatch } from "firebase/firestore";
import { db } from "../../../firebaseConfig";

export const useRecordSaver = () => {
  const [saving, setSaving] = useState(false);

  const saveRecord = async (formData: any) => {
    const {
      userProfile, availableTypes, activities, weight, comment,
      postToTimeline, imageUris, selectedGroupId
    } = formData;

    // --- 1. バリデーション ---
    if (!activities || activities.length === 0) {
      alert('運動内容を入力してください。');
      return false;
    }
    // 時間が0分の運動しかない場合はアラート（入力ミスの防止）
    if (activities.every((act: any) => !act.duration || act.duration <= 0)) {
      alert('少なくとも1つの運動で時間を入力してください。');
      return false;
    }
    // ログインチェック
    if (!userProfile?.uid) {
      alert("ログインが必要です。");
      return false;
    }

    setSaving(true);
    const batch = writeBatch(db);

    try {
      // --- 2. 画像アップロード ---
      const imageUrls: string[] = [];
      if (imageUris && imageUris.length > 0) {
        const storage = getStorage();
        for (const uri of imageUris) {
          // URIからファイル名を取得
          const filename = uri.substring(uri.lastIndexOf('/') + 1);
          // fetchでBlob化 (React Native特有)
          const response = await fetch(uri);
          const blob = await response.blob();

          // Storageパス: exercise_images/{uid}/{timestamp}_{filename}
          const storageRef = ref(storage, `exercise_images/${userProfile.uid}/${Date.now()}_${filename}`);
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          imageUrls.push(url);
        }
      }

      // --- 3. 運動データ整形 (METs情報の結合) ---
      const formattedActivities = activities.map((a: any) => {
        const typeInfo = availableTypes.find((t: any) => t.id === a.typeId);
        // 選択された強度に対応するMETs値を取得
        let mets = 0;
        if (typeInfo && typeInfo.metsValues) {
            mets = typeInfo.metsValues[a.intensity] || 0;
        }

        return {
          ...a,
          name: (typeInfo && typeInfo.name) ? typeInfo.name : "不明な運動",
          mets: mets
        };
      });

      // ハッシュタグ抽出 (#タグ)
      const hashtagRegex = /#\S+/g;
      const hashtags = (comment.match(hashtagRegex) || []);

      // --- 4. 運動記録 (exerciseRecords) 作成 ---
      const exerciseRef = doc(collection(db, "exerciseRecords"));
      batch.set(exerciseRef, {
        userId: userProfile.uid, // ★ここが重要
        activities: formattedActivities,
        comment: comment.trim(),
        imageUrls: imageUrls,
        postToTimeline: postToTimeline,
        createdAt: serverTimestamp(),
        likes: [],
        hashtags: hashtags,
        groupId: selectedGroupId || null
      });

      // --- 5. タイムライン (timeline) 作成 ---
      if (postToTimeline) {
        const timelineRef = doc(collection(db, "timeline"));
        batch.set(timelineRef, {
          userId: userProfile.uid, // ★最重要: これがないとブロック機能などで不具合が出ます
          username: userProfile.username || "匿名",
          userAvatar: userProfile.profileImageUrl || null, // ★追加: アイコンも保存
          text: comment.trim(),
          createdAt: serverTimestamp(),
          exerciseId: exerciseRef.id,
          imageUrls: imageUrls,
          hashtags: hashtags,
          groupId: selectedGroupId || null,
          likes: 0,
          comments: 0,
          activities: formattedActivities
        });
      }

      // --- 6. 体重記録 (healthRecords & users) ---
      if (weight && !isNaN(Number(weight))) {
        const healthRecordRef = doc(collection(db, "healthRecords"));
        const weightNum = Number(weight);
        batch.set(healthRecordRef, {
          userId: userProfile.uid,
          weight: weightNum,
          createdAt: serverTimestamp()
        });
        // ユーザー情報の最新体重も更新
        const userRef = doc(db, "users", userProfile.uid);
        batch.set(userRef, { weight: weightNum }, { merge: true });
      }

      // --- 7. コミット ---
      await batch.commit();

      return true;

    } catch (e: any) {
      console.error("保存エラー:", e);
      alert("保存に失敗しました。");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { saveRecord, saving };
};