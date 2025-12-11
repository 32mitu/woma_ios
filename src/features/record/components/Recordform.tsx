import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
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

  // 運動追加ロジック
  const handleAddActivity = () => {
    setSelectorVisible(true);
  };

  const handleSelectExercise = (type: any) => {
    // ★修正: ここで undefined が入らないようにデフォルト値(0)を設定
    setActivities([
      ...activities,
      {
        id: Date.now().toString(),
        name: type.name || '名称不明',
        intensity: '中',
        duration: 30, 
        mets: type.mid ?? 0, // undefinedなら0にする
        baseMets: { 
          low: type.low ?? 0, 
          mid: type.mid ?? 0, 
          high: type.high ?? 0 
        }
      }
    ]);
    setSelectorVisible(false);
  };

  const handleUpdateActivity = (id: string, field: string, value: any) => {
    setActivities(activities.map(act => {
      if (act.id !== id) return act;
      
      if (field === 'intensity') {
        // 強度が変わったらMETsも更新
        const newMets = act.baseMets[value === '低' ? 'low' : value === '高' ? 'high' : 'mid'] ?? 0;
        return { ...act, intensity: value, mets: newMets };
      }
      return { ...act, [field]: value };
    }));
  };

  const handleRemoveActivity = (id: string) => {
    setActivities(activities.filter(a => a.id !== id));
  };

  const handleCreateSubmit = async (data: { name: string, low: number, mid: number, high: number }) => {
    await createNewExerciseType(data);
    setCreateVisible(false);
  };

  const handleSave = async () => {
    // バリデーション
    if (activities.length === 0 && !comment.trim() && imageUris.length === 0 && !weight) {
      Alert.alert('エラー', '記録する内容（運動、体重、コメント、写真のいずれか）を入力してください');
      return;
    }

    await saveRecord({
      activities,
      weight,
      comment,
      imageUris,
      postToTimeline
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>今日の記録</Text>

        {/* 運動リストセクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>運動メニュー</Text>
          
          {activities.length === 0 ? (
            <Text style={styles.emptyText}>まだ追加されていません</Text>
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

          <TouchableOpacity style={styles.addButton} onPress={handleAddActivity}>
            <Ionicons name="add" size={20} color="#3B82F6" />
            <Text style={styles.addText}>運動を追加する</Text>
          </TouchableOpacity>
        </View>

        {/* 入力フォーム */}
        <RecordFormInputs
          weight={weight}
          setWeight={setWeight}
          comment={comment}
          setComment={setComment}
          imageUris={imageUris}
          setImageUris={setImageUris}
          postToTimeline={postToTimeline}
          setPostToTimeline={setPostToTimeline}
        />

        {/* 保存ボタン */}
        <TouchableOpacity 
          style={[styles.submitButton, saving && styles.disabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>記録を保存</Text>
          )}
        </TouchableOpacity>

      </ScrollView>

      {/* 運動選択モーダル */}
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

      {/* 新規作成モーダル */}
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
    backgroundColor: '#3B82F6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10,
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
  },
  disabled: { backgroundColor: '#93C5FD' },
  submitText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});