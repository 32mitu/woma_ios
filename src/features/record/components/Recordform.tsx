import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router'; // useLocalSearchParams 追加
import { useAuth } from '../../auth/useAuth';
import { useRecordSaver } from '../useRecordSaver';
import { useExerciseTypes } from '../../../hooks/useExerciseTypes';
import { ActivityInput } from './ActivityInput';
import { RecordFormInputs } from './RecordformInputs';
import { ExerciseSelector } from './ExerciseSelector';
import { CreateExerciseTypeForm } from './CreateExerciseTypeForm';
import { Ionicons } from '@expo/vector-icons';

export const RecordForm = () => {
  const router = useRouter();
  
  // ★ URLパラメータから自動取得した歩数を受け取る
  const params = useLocalSearchParams();
  const autoSteps = params.autoSteps ? Number(params.autoSteps) : 0;

  const { userProfile } = useAuth();
  
  // マスタデータ取得 Hooks
  const { availableTypes, createNewExerciseType } = useExerciseTypes(userProfile);
  
  const { saveRecord, saving } = useRecordSaver();

  // State
  const [activities, setActivities] = useState<any[]>([]);
  const [weight, setWeight] = useState('');
  const [comment, setComment] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [postToTimeline, setPostToTimeline] = useState(true);

  // Modals
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);

  // ★ 自動歩数がある場合、初期アクティビティとしてセット
  useEffect(() => {
    if (autoSteps > 0 && activities.length === 0) {
      setActivities([
        {
          id: Date.now().toString(),
          name: 'ウォーキング', // デフォルト
          type: 'walking',
          intensity: '中',
          duration: '', // 時間は不明なので空
          steps: autoSteps, // ★ ここにセット
          mets: 3.5,    // 概算METs
          baseMets: { low: 2.5, mid: 3.5, high: 4.5 }
        }
      ]);
    }
  }, [autoSteps]);

  // ExerciseSelectorからの選択ハンドラ
  const handleSelectExercise = (type: any) => {
    const newActivity = {
      id: Date.now().toString(),
      name: type.name,
      type: type.id, // カスタムの場合はID、プリセットの場合はkey
      intensity: '中',
      duration: '',
      steps: '', // 新規追加時は空
      mets: type.mets?.mid || 0,
      baseMets: type.mets || { low: 0, mid: 0, high: 0 }
    };
    setActivities([...activities, newActivity]);
    setSelectorVisible(false);
  };

  // アクティビティ情報の更新
  const handleUpdateActivity = (id: string, field: string, value: any) => {
    setActivities(activities.map(act => {
      if (act.id !== id) return act;
      
      const updated = { ...act, [field]: value };
      
      // 強度が変わったらMETsも更新
      if (field === 'intensity' && act.baseMets) {
        if (value === '低') updated.mets = act.baseMets.low;
        if (value === '中') updated.mets = act.baseMets.mid;
        if (value === '高') updated.mets = act.baseMets.high;
      }
      
      return updated;
    }));
  };

  // 削除
  const handleRemoveActivity = (id: string) => {
    setActivities(activities.filter(a => a.id !== id));
  };

  // 新規種目作成
  const handleCreateSubmit = async (data: { name: string, low: number, mid: number, high: number }) => {
    await createNewExerciseType(data);
    setCreateVisible(false);
    // 自動的に選択状態にするなどは省略（必要なら実装）
    Alert.alert('完了', '新しい運動を作成しました。リストから選択してください。');
  };

  // 保存処理
  const handleSave = async () => {
    if (activities.length === 0 && !weight && !comment && imageUris.length === 0) {
      Alert.alert('エラー', '記録する内容がありません');
      return;
    }

    await saveRecord({
      activities,
      weight,
      comment,
      imageUris,
      postToTimeline
    });
    
    // 成功したら戻る (saveRecord内でToast等は処理済と仮定、またはここで戻る)
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.pageTitle}>今日の記録</Text>

        {/* 運動リスト */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>運動</Text>
          
          {activities.length === 0 ? (
            <Text style={styles.emptyText}>まだ運動が選択されていません</Text>
          ) : (
            activities.map((act, index) => (
              <ActivityInput
                key={act.id}
                index={index}
                activity={act}
                onUpdate={handleUpdateActivity}
                onRemove={handleRemoveActivity}
              />
            ))
          )}

          <TouchableOpacity style={styles.addButton} onPress={() => setSelectorVisible(true)}>
            <Ionicons name="add" size={20} color="#3B82F6" />
            <Text style={styles.addText}>運動を追加する</Text>
          </TouchableOpacity>
        </View>

        {/* その他の入力 (体重、コメント、画像) */}
        <RecordFormInputs
          weight={weight} setWeight={setWeight}
          comment={comment} setComment={setComment}
          imageUris={imageUris} setImageUris={setImageUris}
          postToTimeline={postToTimeline} setPostToTimeline={setPostToTimeline}
        />

        {/* 送信ボタン */}
        <TouchableOpacity 
          style={[styles.submitButton, saving && styles.disabledButton]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>記録する (えらい！)</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* モーダル群 */}
      <ExerciseSelector
        visible={selectorVisible}
        availableTypes={availableTypes}
        onClose={() => setSelectorVisible(false)}
        onSelect={handleSelectExercise}
        onCreateNew={() => {
            setSelectorVisible(false);
            setCreateVisible(true);
        }}
      />

      <CreateExerciseTypeForm
        visible={createVisible}
        onSubmit={handleCreateSubmit}
        onCancel={() => setCreateVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  pageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#1F2937' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginBottom: 12, fontSize: 14 },
  addButton: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    padding: 14, borderWidth: 1, borderColor: '#3B82F6', borderRadius: 12, 
    borderStyle: 'dashed', backgroundColor: '#EFF6FF' 
  },
  addText: { color: '#3B82F6', fontWeight: 'bold', marginLeft: 8 },
  submitButton: {
    backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 12, marginTop: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
  },
  disabledButton: { backgroundColor: '#93C5FD' },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
});