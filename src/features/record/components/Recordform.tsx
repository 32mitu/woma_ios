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
import { useHealthKit } from '../../../hooks/useHealthKit';

export const RecordForm = () => {
  const router = useRouter();
  const { userProfile } = useAuth();
  
  const { availableTypes, createNewExerciseType } = useExerciseTypes(userProfile);
  const { saveRecord, saving } = useRecordSaver();
  const { getTodaySteps, loading: healthLoading } = useHealthKit();

  const [activities, setActivities] = useState<any[]>([]);
  const [weight, setWeight] = useState(''); 
  const [comment, setComment] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [postToTimeline, setPostToTimeline] = useState(true);

  const [selectorVisible, setSelectorVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);

  // 体重の決定 (入力値優先、なければプロフィール)
  const effectiveWeight = weight || (userProfile?.weight ? String(userProfile.weight) : '');

  const handleAddActivity = () => {
    setSelectorVisible(true);
  };

  // ★修正ポイント: データ構造の違いを吸収するロジック
  const handleSelectExercise = (type: any) => {
    let lowVal, midVal, highVal;

    // パターンA: metsValues オブジェクトを持っている場合 (デフォルトのマスタデータなど)
    if (type.metsValues) {
      lowVal = type.metsValues['低'];
      midVal = type.metsValues['中'];
      highVal = type.metsValues['高'];
    } 
    // パターンB: フラットな構造の場合 (自分で作ったカスタム運動など)
    else {
      lowVal = type.low;
      midVal = type.mid;
      highVal = type.high;
    }

    // 数値変換と安全策 (NaNならデフォルト値へ)
    const low = parseFloat(lowVal) || 3.0;
    const mid = parseFloat(midVal) || 3.5; // ここで正しい値 (例: ウォーキングなら4) が入る
    const high = parseFloat(highVal) || 5.0;

    setActivities([
      ...activities,
      {
        id: Date.now().toString(),
        name: type.name || '名称不明',
        intensity: '中',
        duration: 30, 
        steps: 0, 
        mets: mid, // デフォルト強度「中」のMETsをセット
        baseMets: { low, mid, high }
      }
    ]);
    setSelectorVisible(false);
  };

  const handleUpdateActivity = (id: string, field: string, value: any) => {
    setActivities(activities.map(act => {
      if (act.id !== id) return act;
      
      if (field === 'intensity') {
        // 強度が変わったらMETsも更新
        const newMets = act.baseMets[value === '低' ? 'low' : value === '高' ? 'high' : 'mid'] ?? 3.5;
        return { ...act, intensity: value, mets: newMets };
      }
      return { ...act, [field]: value };
    }));
  };

  const handleRemoveActivity = (id: string) => {
    setActivities(activities.filter(a => a.id !== id));
  };

  const handleImportHealthData = async () => {
    try {
      const steps = await getTodaySteps();
      
      if (!steps || steps === 0) {
        // 文言変更：情報源を明確に
        Alert.alert("Appleヘルスケア", "今日の歩数データが見つかりませんでした。(または0歩)");
        return;
      }

      const walkIndex = activities.findIndex(a => a.name.includes('ウォーキング') || a.name.includes('歩行'));
      
      if (walkIndex >= 0) {
        const updated = [...activities];
        updated[walkIndex].steps = steps;
        setActivities(updated);
        Alert.alert("Apple Health連携", `既存のウォーキング記録に ${steps.toLocaleString()}歩 を設定しました。`);
      } else {
        // マスタから「ウォーキング」を探す
        const walkType = availableTypes.find(t => t.name.includes('ウォーキング'));
        
        // ウォーキングのMETsを取得 (なければデフォルト)
        let wLow = 3.0, wMid = 3.5, wHigh = 4.0;
        if (walkType) {
            if (walkType.metsValues) {
                wLow = walkType.metsValues['低'] || 3.0;
                wMid = walkType.metsValues['中'] || 3.5;
                wHigh = walkType.metsValues['高'] || 4.0;
            } else {
                wLow = walkType.low || 3.0;
                wMid = walkType.mid || 3.5;
                wHigh = walkType.high || 4.0;
            }
        }

        const newActivity = {
          id: Date.now().toString(),
          name: walkType?.name || 'ウォーキング',
          intensity: '中',
          duration: 0, 
          steps: steps,
          mets: Number(wMid),
          baseMets: {
            low: Number(wLow),
            mid: Number(wMid),
            high: Number(wHigh),
          }
        };
        setActivities([...activities, newActivity]);
        // 文言変更：情報源を明確に
        Alert.alert("Apple Health連携", `ヘルスケアから ${steps.toLocaleString()}歩 を取得しました。`);
      }
    } catch (error) {
      console.error("HealthKit Error:", error);
      Alert.alert("エラー", "Appleヘルスケアデータの取得に失敗しました。設定 > プライバシー > ヘルスケア から権限を確認してください。");
    }
  };

  const handleCreateSubmit = async (data: { name: string, low: number, mid: number, high: number }) => {
    await createNewExerciseType(data);
    setCreateVisible(false);
  };

  const handleSave = async () => {
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

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={styles.sectionTitle}>運動メニュー</Text>
            
            <TouchableOpacity 
              style={styles.healthButton} 
              onPress={handleImportHealthData}
              disabled={healthLoading}
            >
              {healthLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                // アイコンをハートマークに変更 (HealthKitらしさの強調)
                <Ionicons name="heart" size={16} color="white" />
              )}
              <Text style={styles.healthButtonText}>
                {healthLoading ? '取得中...' : 'Appleヘルスケアから取得'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 審査対策: クレジット表記を明示的に追加 */}
          <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
             <Text style={styles.attributionText}>Data from Apple Health</Text>
          </View>
          
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
                weight={effectiveWeight} 
              />
            ))
          )}

          <TouchableOpacity style={styles.addButton} onPress={handleAddActivity}>
            <Ionicons name="add" size={20} color="#3B82F6" />
            <Text style={styles.addText}>運動を追加する</Text>
          </TouchableOpacity>
        </View>

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
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
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
  healthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FA586A', // Apple Healthに近いピンク/赤系の色に変更するとより分かりやすい(任意)
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
  },
  healthButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // 新規追加スタイル
  attributionText: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    marginRight: 4
  }
});