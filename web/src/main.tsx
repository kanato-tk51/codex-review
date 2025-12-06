import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, AppShell, Container, Title, Text, Button, Group, List } from '@mantine/core';
import '@mantine/core/styles.css';

const App = () => (
  <MantineProvider>
    <AppShell padding="md">
      <AppShell.Header>
        <Container>
          <Title order={3} style={{ padding: '12px 0' }}>codex-review (MVP UI placeholder)</Title>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container>
          <Title order={4}>セットアップ手順</Title>
          <List spacing="xs" mt="sm">
            <List.Item>1. `/api/repos` に POST してリポジトリを登録</List.Item>
            <List.Item>2. テンプレートを `/api/templates` で作成</List.Item>
            <List.Item>3. `/api/reviews` に repoId / templateIds / branch を渡して実行</List.Item>
            <List.Item>4. SSE: `/api/reviews/:id/stream` で進捗購読</List.Item>
          </List>
          <Group mt="lg">
            <Button component="a" href="/api/health" target="_blank">API Health</Button>
            <Button component="a" href="https://github.com" target="_blank" variant="light">Docs (TODO)</Button>
          </Group>
          <Text mt="xl" c="dimmed">本UIはプレースホルダです。React Query 等で実装を拡張してください。</Text>
        </Container>
      </AppShell.Main>
    </AppShell>
  </MantineProvider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
