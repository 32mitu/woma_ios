import { Stack } from 'expo-router';
// useEffect と usePathname の import も不要になったので削除してOKですが、残しても害はありません

export default function DMLayout() {
  // ログ出力処理を全削除

  return (
    <Stack>
      {/* メッセージ一覧 (app/dm/index.tsx) */}
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'メッセージ',
          headerBackTitle: '戻る'
        }} 
      />
      
      {/* チャット詳細 (app/dm/[id].tsx) */}
      <Stack.Screen 
        name="[id]" 
        options={{ 
          title: 'チャット', 
          headerBackTitle: '一覧' 
        }} 
      />
    </Stack>
  );
}