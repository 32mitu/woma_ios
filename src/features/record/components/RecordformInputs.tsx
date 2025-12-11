import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

type Props = {
  weight: string;
  setWeight: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
  imageUris: string[];
  setImageUris: (uris: string[]) => void;
  postToTimeline: boolean;
  setPostToTimeline: (v: boolean) => void;
};

export const RecordFormInputs = ({
  weight, setWeight,
  comment, setComment,
  imageUris, setImageUris,
  postToTimeline, setPostToTimeline
}: Props) => {

  const pickImage = async () => {
    // 権限リクエスト（必要に応じて）
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("アクセス許可が必要です", "カメラロールへのアクセスを許可してください。");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // ★ 複数選択を有効化
      allowsMultipleSelection: true,
      selectionLimit: 5, // 最大5枚までなど制限可能
      // 注意: allowsMultipleSelection: true の場合、allowsEditing (トリミング) は使えません
      allowsEditing: false, 
      quality: 0.7,
    });

    if (!result.canceled) {
      // 選択されたすべての画像を既存のリストに追加
      const newUris = result.assets.map(asset => asset.uri);
      // 重複を防ぎたい場合はSetを使うなどの工夫も可能ですが、ここでは単純追加
      setImageUris([...imageUris, ...newUris]);
    }
  };

  const removeImage = (index: number) => {
    const newUris = [...imageUris];
    newUris.splice(index, 1);
    setImageUris(newUris);
  };

  return (
    <View style={styles.section}>
      {/* 体重入力 */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>今日の体重 <Text style={styles.optional}>(任意)</Text></Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          placeholder="kg"
        />
      </View>

      {/* コメント入力 */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>ひとこと <Text style={styles.optional}>(任意)</Text></Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={comment}
          onChangeText={setComment}
          placeholder="今日はどんな運動をしましたか？"
          multiline
          numberOfLines={4}
        />
      </View>

      {/* 画像選択 */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>写真を追加 <Text style={styles.optional}>(最大5枚)</Text></Text>
        <View style={styles.imageContainer}>
          {imageUris.map((uri, index) => (
            <View key={index} style={styles.thumbnailWrapper}>
              <Image source={{ uri }} style={styles.thumbnail} />
              <TouchableOpacity 
                style={styles.removeBtn} 
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
          
          {/* 追加ボタン (5枚未満のときだけ表示) */}
          {imageUris.length < 5 && (
            <TouchableOpacity style={styles.addBtn} onPress={pickImage}>
              <Ionicons name="camera" size={24} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* タイムライン投稿スイッチ */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>タイムラインに投稿する</Text>
        <Switch 
          value={postToTimeline} 
          onValueChange={setPostToTimeline}
          trackColor={{ false: "#767577", true: "#3B82F6" }}
          thumbColor={postToTimeline ? "#fff" : "#f4f3f4"}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginVertical: 10 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  optional: { fontSize: 12, color: '#9CA3AF', fontWeight: 'normal' },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  
  imageContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbnailWrapper: { position: 'relative' },
  thumbnail: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#eee' },
  removeBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: 'white', borderRadius: 12 },
  
  addBtn: { 
    width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', 
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' 
  },
  
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB'
  },
});