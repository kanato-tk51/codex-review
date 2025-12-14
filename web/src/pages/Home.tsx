import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Menu,
  Loader,
  Select,
  Stack,
  Text,
  Title,
  Checkbox,
  Textarea,
  TextInput,
  Modal,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
// simple trash icon path (no extra dependency)
const TrashIcon = ({ size = 16, color = '#e54848' }: { size?: number; color?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M14 10v6" />
    <path d="M10 10v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RepoSummary,
  addManualRepo,
  fetchAutoRepos,
  fetchManualRepos,
  deleteRepo,
  refreshAutoRepos,
  fetchTemplates,
  createTemplate,
  updateTemplate,
  removeTemplate,
  runReview,
  fetchReview,
  openReviewStream,
  fetchCsrf,
  runCustomShellCommand,
  openShellStream,
  TemplateRecord,
  ReviewRun,
  ReviewTask,
  RunStatus,
} from '../api/client';

const ANSI_COLORS: Record<string, string> = {
  '30': '#000000',
  '31': '#c01c28',
  '32': '#26a269',
  '33': '#a2734c',
  '34': '#12488b',
  '35': '#a347ba',
  '36': '#2aa1b3',
  '37': '#d0cfcc',
  '90': '#555753',
  '91': '#ff6c6b',
  '92': '#98be65',
  '93': '#ecbe7b',
  '94': '#51afef',
  '95': '#c678dd',
  '96': '#46d9ff',
  '97': '#dfdfdf',
};

function ansiToHtml(input: string) {
  let html = '';
  let lastIndex = 0;
  let currentColor = '';
  let currentBg = '';
  let bold = false;
  const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const close = () => {
    if (bold || currentColor || currentBg) html += '</span>';
    bold = false;
    currentColor = '';
    currentBg = '';
  };
  const regex = /\x1b\[(\d+(?:;\d+)*)m/g;
  let match;
  while ((match = regex.exec(input))) {
    html += escapeHtml(input.slice(lastIndex, match.index));
    const codes = match[1].split(';');
    codes.forEach((code) => {
      if (code === '0') {
        close();
      } else if (code === '1') {
        close();
        bold = true;
      } else if (ANSI_COLORS[code]) {
        close();
        currentColor = ANSI_COLORS[code];
      } else if (Number(code) >= 40 && Number(code) <= 47) {
        close();
        const fg = ANSI_COLORS[String(Number(code) - 10)];
        currentBg = fg || '';
      } else if (Number(code) >= 100 && Number(code) <= 107) {
        close();
        const fg = ANSI_COLORS[String(Number(code) - 60)];
        currentBg = fg || '';
      }
    });
    if (bold || currentColor || currentBg) {
      const styles = [
        bold ? 'font-weight:700' : '',
        currentColor ? `color:${currentColor}` : '',
        currentBg ? `background:${currentBg}` : '',
      ]
        .filter(Boolean)
        .join(';');
      html += `<span style="${styles}">`;
    }
    lastIndex = regex.lastIndex;
  }
  html += escapeHtml(input.slice(lastIndex));
  if (bold || currentColor || currentBg) html += '</span>';
  return html;
}
const cardStyle = {
  backgroundColor: '#fdfcf9',
  border: '1px solid #e1e0dc',
};

function RepoCard({ repo, onClick, onDelete }: { repo: RepoSummary; onClick: (repo: RepoSummary) => void; onDelete: (repo: RepoSummary) => void }) {
  return (
    <Card
      withBorder
      shadow="xs"
      style={{ ...cardStyle, cursor: 'pointer' }}
      padding="lg"
      radius="sm"
      onClick={() => onClick(repo)}
    >
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Text fw={800} style={{ letterSpacing: '0.02em' }}>
            {repo.name}
          </Text>
          <Text size="xs" c="dimmed">{repo.path}</Text>
          <Text size="sm" c="dimmed">
            作成日 {new Date(repo.createdAt || repo.fetchedAt || Date.now()).toISOString().slice(0, 10)}
          </Text>
        </Stack>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Text c="dimmed" style={{ cursor: 'pointer', fontWeight: 700 }} onClick={(e) => e.stopPropagation()}>
              …
            </Text>
          </Menu.Target>
          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
            <Menu.Item
              color="red"
              leftSection={<TrashIcon size={16} color="#e54848" />}
              onClick={() => onDelete(repo)}
            >
              削除
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Card>
  );
}

function BranchView({ repo, onBack }: { repo: RepoSummary; onBack: () => void }) {
  const [selectedBranch, setSelectedBranch] = useState(repo.branches[0]);
  const templatesQuery = useQuery({ queryKey: ['templates', repo.id], queryFn: () => fetchTemplates(repo.id) });
  const queryClient = useQueryClient();

  const [checked, setChecked] = useState<string[]>([]);
  const [checkedReady, setCheckedReady] = useState(false);
  const [editing, setEditing] = useState<Record<string, Partial<TemplateRecord>>>({});
  const [newDraft, setNewDraft] = useState<(Partial<TemplateRecord> & { target: 'repo' | 'global' }) | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [orderedRepo, setOrderedRepo] = useState<TemplateRecord[]>([]);
  const [orderedGlobal, setOrderedGlobal] = useState<TemplateRecord[]>([]);
  const [dragging, setDragging] = useState<{ id: string; list: 'repo' | 'global' } | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [taskMeta, setTaskMeta] = useState<Record<string, { templateId: string }>>({});
  const [taskStatuses, setTaskStatuses] = useState<Record<string, { status: RunStatus; error?: string }>>({});
  const [taskLogs, setTaskLogs] = useState<Record<string, string>>({});
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<Record<string, string>>({});
  const [terminalStatus, setTerminalStatus] = useState<Record<string, { running: boolean; exitCode?: number | null; error?: string }>>({});
  const [terminalStreams, setTerminalStreams] = useState<Record<string, EventSource | undefined>>({});
  const [commandInput, setCommandInput] = useState<Record<string, string>>({});

  const storageKey = `templateChecked:${repo.id}`;

  useEffect(() => {
    if (!templatesQuery.data || checkedReady) return;
    const all = [...templatesQuery.data.repo, ...templatesQuery.data.global];
    const saved =
      typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    const initial = saved
      ? (JSON.parse(saved) as string[]).filter((id) => all.some((t) => t.id === id))
      : all.map((t) => t.id);
    setChecked(initial);
    setCheckedReady(true);
  }, [templatesQuery.data, storageKey, checkedReady]);

  useEffect(() => {
    if (!checkedReady || typeof window === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, storageKey, checkedReady]);

  useEffect(() => {
    if (!templatesQuery.data || !checkedReady) return;
    const allIds = [...templatesQuery.data.repo, ...templatesQuery.data.global].map((t) => t.id);
    setChecked((prev) => prev.filter((id) => allIds.includes(id)));
  }, [templatesQuery.data, checkedReady]);

  const templateNameMap = useMemo(() => {
    if (!templatesQuery.data) return {} as Record<string, string>;
    const all = [...templatesQuery.data.repo, ...templatesQuery.data.global];
    return all.reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {} as Record<string, string>);
  }, [templatesQuery.data]);

  const saveTemplate = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TemplateRecord> }) => updateTemplate(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const addTemplate = useMutation({
    mutationFn: (payload: Partial<TemplateRecord>) => createTemplate(payload),
    onSuccess: (tpl) => {
      queryClient.invalidateQueries({ queryKey: ['templates', repo.id] });
      setChecked((prev) => [...prev, tpl.id]);
      setNewDraft(null);
    },
  });

  useEffect(() => {
    if (!templatesQuery.data) return;
    const asc = (arr: TemplateRecord[]) =>
      [...arr].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    setOrderedRepo(asc(templatesQuery.data.repo));
    setOrderedGlobal(asc(templatesQuery.data.global));
  }, [templatesQuery.data]);

  const reorder = (list: TemplateRecord[], fromId: string, toId: string) => {
    const fromIndex = list.findIndex((t) => t.id === fromId);
    const toIndex = list.findIndex((t) => t.id === toId);
    if (fromIndex === -1 || toIndex === -1) return list;
    const next = [...list];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
  };

  const sortedRepoTemplates = useMemo(() => {
    if (!templatesQuery.data) return [] as TemplateRecord[];
    return [...templatesQuery.data.repo].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
  }, [templatesQuery.data]);

  const sortedGlobalTemplates = useMemo(() => {
    if (!templatesQuery.data) return [] as TemplateRecord[];
    return [...templatesQuery.data.global].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
  }, [templatesQuery.data]);

  const deleteTemplateMut = useMutation({
    mutationFn: (id: string) => removeTemplate(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<{ repo: TemplateRecord[]; global: TemplateRecord[] }>(['templates', repo.id], (prev) => {
        if (!prev) return { repo: [], global: [] };
        return { repo: prev.repo.filter((t) => t.id !== id), global: prev.global.filter((t) => t.id !== id) };
      });
      setConfirmDeleteId(null);
    },
  });

  const runQuery = useQuery({
    queryKey: ['review', currentRunId],
    queryFn: () => fetchReview(currentRunId as string),
    enabled: Boolean(currentRunId),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!runQuery.data) return;
    const meta = runQuery.data.tasks.reduce(
      (acc, t) => ({ ...acc, [t.id]: { templateId: t.template_id } }),
      {} as Record<string, { templateId: string }>
    );
    setTaskMeta(meta);
    setTaskStatuses((prev) => {
      const next = { ...prev };
      runQuery.data.tasks.forEach((t) => {
        next[t.id] = { status: t.status, error: t.error };
      });
      return next;
    });
    // 既に完了済みのタスクは詳細を初期表示
    setTaskLogs((prev) => {
      const next = { ...prev };
      runQuery.data.tasks.forEach((t) => {
        if (t.result_detail && !next[t.id]) {
          next[t.id] = t.result_detail;
        }
      });
      return next;
    });
  }, [runQuery.data]);

  useEffect(() => {
    if (!currentRunId) return;
    const es = openReviewStream(currentRunId, (type, payload) => {
      if (type === 'task_started') {
        setTaskStatuses((prev) => ({ ...prev, [payload.taskId]: { status: 'running' } }));
      } else if (type === 'task_completed') {
        setTaskStatuses((prev) => ({ ...prev, [payload.taskId]: { status: 'done' } }));
      } else if (type === 'task_failed') {
        setTaskStatuses((prev) => ({ ...prev, [payload.taskId]: { status: 'error', error: payload.error } }));
      } else if (type === 'task_progress') {
        if (!payload?.chunk || !payload.taskId) return;
        setTaskLogs((prev) => ({
          ...prev,
          [payload.taskId]: (prev[payload.taskId] || '') + payload.chunk,
        }));
      }
    });
    return () => es.close();
  }, [currentRunId]);

  useEffect(() => {
    return () => {
      Object.values(terminalStreams).forEach((es) => es?.close());
    };
  }, [terminalStreams]);

  const runMutation = useMutation({
    mutationFn: () => runReview({ repoId: repo.id, baseBranch: selectedBranch, templateIds: checked }),
    onSuccess: (res) => {
      Object.values(terminalStreams).forEach((es) => es?.close());
      setCurrentRunId(res.runId);
      setTaskMeta({});
      setTaskStatuses({});
      setRunMessage(`実行を開始しました (runId: ${res.runId})`);
      setTerminalLogs({});
      setTerminalStatus({});
      setTerminalStreams({});
    },
    onError: (err: any) => setRunMessage(err?.message || '実行に失敗しました'),
  });

  const ensureCsrf = async () => {
    if (csrfToken) return csrfToken;
    const res = await fetchCsrf();
    setCsrfToken(res.token);
    return res.token;
  };

  const startTerminalCommand = async (templateId: string) => {
    const cmd = (commandInput[templateId] || '').trim();
    if (!cmd) {
      setTerminalStatus((prev) => ({ ...prev, [templateId]: { running: false, error: 'コマンドを入力してください' } }));
      return;
    }
    try {
      const token = await ensureCsrf();
      setTerminalStatus((prev) => ({ ...prev, [templateId]: { running: true } }));
      setTerminalLogs((prev) => ({ ...prev, [templateId]: prev[templateId] || '' }));
      const res = await runCustomShellCommand(cmd, token, repo.path);
      const es = openShellStream(res.runId, (type, payload) => {
        if (type === 'start') {
          setTerminalLogs((prev) => ({
            ...prev,
            [templateId]: (prev[templateId] || '') + `$ ${payload.data}\n`,
          }));
        } else if (type === 'stdout' || type === 'stderr') {
          setTerminalLogs((prev) => ({
            ...prev,
            [templateId]: (prev[templateId] || '') + (payload.data || ''),
          }));
        } else if (type === 'exit') {
          setTerminalStatus((prev) => ({ ...prev, [templateId]: { running: false, exitCode: payload.code } }));
        } else if (type === 'error') {
          setTerminalStatus((prev) => ({ ...prev, [templateId]: { running: false, error: payload.data } }));
        }
      });
      setTerminalStreams((prev) => ({ ...prev, [templateId]: es }));
    } catch (err: any) {
      setTerminalStatus((prev) => ({ ...prev, [templateId]: { running: false, error: err?.message || '失敗しました' } }));
    }
  };

  return (
    <Box p="lg" style={{ background: '#faf7ef', minHeight: '100vh' }}>
      <Stack gap="md" mt="lg" style={{ maxWidth: 1100, margin: '0 auto', color: '#111' }}>
        <Modal
          opened={Boolean(confirmDeleteId)}
          onClose={() => setConfirmDeleteId(null)}
          title="テンプレートを削除しますか？"
          centered
        >
          <Group justify="flex-end" mt="md" gap="sm">
            <Button variant="outline" color="gray" onClick={() => setConfirmDeleteId(null)}>
              キャンセル
            </Button>
            <Button
              variant="filled"
              color="red"
              onClick={() => confirmDeleteId && deleteTemplateMut.mutate(confirmDeleteId)}
              loading={deleteTemplateMut.isPending}
            >
              削除
            </Button>
          </Group>
        </Modal>

        <Group justify="space-between">
          <Group gap="xs">
            <Button variant="subtle" color="dark" onClick={onBack}>
              ← 戻る
            </Button>
            <Title order={3} style={{ letterSpacing: '0.02em' }}>
              {repo.name}
            </Title>
          </Group>
          <Text size="sm" c="dark">
            {repo.path}
          </Text>
        </Group>
        {repo.branchStatus === 'error' && (
          <Alert color="red" title="ブランチ取得に失敗しました">
            {repo.branchError || 'unknown error'}
          </Alert>
        )}
        <Select
          label="ブランチ"
          placeholder="選択"
          data={(repo.branches || []).map((b) => ({ label: b, value: b }))}
          value={selectedBranch}
          onChange={(v) => setSelectedBranch(v || '')}
          disabled={repo.branchStatus !== 'ok'}
        />

        <Divider label="テンプレート" color="dark" />
        {templatesQuery.isLoading && <Loader />}
        {templatesQuery.error && <Alert color="red">テンプレートの取得に失敗しました</Alert>}
        {templatesQuery.data && (
          <Stack gap="lg">
            {[
              { title: `${repo.name} 用プロンプト`, items: orderedRepo, target: 'repo' as const },
              { title: '全体共通プロンプト', items: orderedGlobal, target: 'global' as const },
            ].map((section) => (
              <Stack gap="sm" key={section.title}>
                <Text fw={700}>{section.title}</Text>
                {section.items.map((tpl) => {
                  const draft = editing[tpl.id] || tpl;
                  const isEditing = editingId === tpl.id;
                  return (
                    <Card
                      className={`template-card ${dragging?.id === tpl.id ? 'dragging' : ''}`}
                      key={tpl.id}
                      withBorder
                      shadow="xs"
                      style={{
                        borderColor: '#111',
                        color: '#111',
                        opacity: dragging?.id === tpl.id ? 0.65 : 1,
                        cursor: 'grab',
                      }}
                      draggable
                      onDragStart={(e) => {
                        setDragging({ id: tpl.id, list: section.target });
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        if (dragging?.list === section.target) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragging || dragging.list !== section.target) return;
                        if (dragging.id === tpl.id) return;
                        if (section.target === 'repo') setOrderedRepo((prev) => reorder(prev, dragging.id, tpl.id));
                        else setOrderedGlobal((prev) => reorder(prev, dragging.id, tpl.id));
                        setDragging(null);
                      }}
                      onDragEnd={() => setDragging(null)}
                    >
                      {!isEditing && (
                        <Group justify="space-between" align="center">
                          <Checkbox
                            color="dark"
                            checked={checked.includes(tpl.id)}
                            onChange={(e) => {
                              setChecked((prev) =>
                                e.currentTarget.checked ? [...prev, tpl.id] : prev.filter((id) => id !== tpl.id)
                              );
                            }}
                            label={tpl.name}
                            styles={{ label: { fontWeight: 700, color: '#111' } }}
                          />
                        <Group gap="xs" align="center">
                            <Button variant="outline" color="dark" size="xs" onClick={() => setEditingId(tpl.id)}>
                              編集
                            </Button>
                            <Button
                              variant="outline"
                              color="red"
                              size="xs"
                              onClick={() => setConfirmDeleteId(tpl.id)}
                            >
                              削除
                            </Button>
                          </Group>
                        </Group>
                      )}

                      {isEditing && (
                        <>
                          <Group justify="space-between" align="center" gap="xs">
                            <Checkbox
                              color="dark"
                              checked={checked.includes(tpl.id)}
                              onChange={(e) => {
                                setChecked((prev) =>
                                  e.currentTarget.checked ? [...prev, tpl.id] : prev.filter((id) => id !== tpl.id)
                                );
                              }}
                              label={tpl.name}
                              styles={{ label: { fontWeight: 700, color: '#111' } }}
                            />
                            <Group gap="xs" align="center">
                              <Button
                                variant="outline"
                                color="dark"
                                size="xs"
                                onClick={() => saveTemplate.mutate({ id: tpl.id, payload: draft })}
                                loading={saveTemplate.isPending}
                              >
                                保存
                              </Button>
                              <Button variant="outline" color="dark" size="xs" onClick={() => setEditingId(null)}>
                                閉じる
                              </Button>
                              <Button
                                variant="outline"
                                color="red"
                                size="xs"
                                onClick={() => setConfirmDeleteId(tpl.id)}
                              >
                                削除
                              </Button>
                            </Group>
                          </Group>
                          <TextInput
                            mt="sm"
                            label="名前"
                            value={draft.name}
                            onChange={(e) =>
                              setEditing((prev) => ({ ...prev, [tpl.id]: { ...draft, name: e.currentTarget.value } }))
                            }
                          />
                          <Textarea
                            mt="xs"
                            label="プロンプト"
                            autosize
                            minRows={3}
                            value={draft.user_prompt_template}
                            onChange={(e) =>
                              setEditing((prev) => ({ ...prev, [tpl.id]: { ...draft, user_prompt_template: e.currentTarget.value } }))
                            }
                          />
                        </>
                      )}

                      {currentRunId && checked.includes(tpl.id) && (
                        <Box mt="sm">
                          <Text fw={700} size="sm" mb={4}>
                            ターミナル
                          </Text>
                          <Box
                            component="pre"
                            style={{
                              margin: 0,
                              padding: '10px',
                              background: '#111',
                              border: '1px solid #2e2e2e',
                              borderRadius: 6,
                              minHeight: 80,
                              maxHeight: 240,
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'Menlo, monospace',
                              fontSize: 12,
                              color: '#e5e5e5',
                            }}
                            dangerouslySetInnerHTML={{
                              __html: ansiToHtml(terminalLogs[tpl.id] || 'コマンドを入力して実行してください'),
                            }}
                          >
                          </Box>
                          <Group mt="xs" gap="xs" align="center">
                            <TextInput
                              placeholder="例: ls -la"
                              value={commandInput[tpl.id] || ''}
                              onChange={(e) =>
                                setCommandInput((prev) => ({ ...prev, [tpl.id]: e.currentTarget.value }))
                              }
                              style={{ flex: 1 }}
                            />
                            <Button
                              variant="outline"
                              color="dark"
                              size="xs"
                              onClick={() => startTerminalCommand(tpl.id)}
                              loading={terminalStatus[tpl.id]?.running}
                            >
                              実行
                            </Button>
                          </Group>
                          {terminalStatus[tpl.id]?.exitCode !== undefined && (
                            <Text size="xs" c="dimmed" mt={4}>
                              終了コード: {terminalStatus[tpl.id]?.exitCode}
                            </Text>
                          )}
                          {terminalStatus[tpl.id]?.error && (
                            <Text size="xs" c="red" mt={4}>
                              {terminalStatus[tpl.id]?.error}
                            </Text>
                          )}
                        </Box>
                      )}
                    </Card>
                  );
                })}

                {(!newDraft || newDraft.target !== section.target) && (
                  <Button
                    variant="outline"
                    color="dark"
                  onClick={() =>
                    setNewDraft({ name: '', user_prompt_template: '', repo_id: section.target === 'repo' ? repo.id : null, target: section.target })
                  }
                >
                  プロンプト新規作成
                </Button>
              )}

                {newDraft && newDraft.target === section.target && (
                  <Card withBorder shadow="xs" style={{ borderColor: '#111', color: '#111' }}>
                    <Group justify="space-between" align="center" mb="xs">
                      <Text fw={700}>新規プロンプト（{section.title}）</Text>
                      <Group gap="xs">
                        <Button
                          variant="outline"
                          color="dark"
                          size="xs"
                          onClick={() => addTemplate.mutate(newDraft)}
                          loading={addTemplate.isPending}
                          disabled={!newDraft.name || !newDraft.user_prompt_template}
                        >
                          保存
                        </Button>
                        <Button variant="outline" color="dark" size="xs" onClick={() => setNewDraft(null)}>
                          閉じる
                        </Button>
                        <Button variant="outline" color="red" size="xs" onClick={() => setNewDraft(null)}>
                          削除
                        </Button>
                      </Group>
                    </Group>
                    <TextInput
                      mt="sm"
                      label="名前"
                      value={newDraft.name || ''}
                      onChange={(e) => setNewDraft((prev) => ({ ...(prev || {}), name: e.currentTarget.value }))}
                    />
                    <Textarea
                      mt="xs"
                      label="プロンプト"
                      autosize
                      minRows={3}
                      value={newDraft.user_prompt_template || ''}
                      onChange={(e) =>
                        setNewDraft((prev) => ({ ...(prev || {}), user_prompt_template: e.currentTarget.value }))
                      }
                    />
                  </Card>
                )}
              </Stack>
            ))}
          </Stack>
        )}

        <Divider />
        <Group justify="flex-start" gap="md" align="center">
          <Button
            variant="filled"
            color="dark"
            onClick={() => runMutation.mutate()}
            disabled={!selectedBranch || checked.length === 0}
            loading={runMutation.isPending}
          >
            実行
          </Button>
          {runMessage && <Text c="dark">{runMessage}</Text>}
          {runQuery.data?.run && (
            <Text c="dark" size="sm">
              ステータス: {runQuery.data.run.status}
            </Text>
          )}
        </Group>

        {currentRunId && (
          <Stack gap="xs">
            <Text fw={700}>実行中のプロンプト</Text>
            {Object.keys(taskMeta).length === 0 && <Text size="sm">初期化中...</Text>}
            {Object.keys(taskMeta).length > 0 &&
              Array.from(
                new Set([...Object.keys(taskMeta), ...Object.keys(taskStatuses)])
              ).map((taskId) => {
                const templateId = taskMeta[taskId]?.templateId;
                const name = templateId ? templateNameMap[templateId] || templateId : taskId;
                const status = taskStatuses[taskId]?.status || 'queued';
                const error = taskStatuses[taskId]?.error;
                const color =
                  status === 'done' ? 'green' : status === 'running' ? 'blue' : status === 'error' ? 'red' : 'gray';
                return (
                  <Card
                    key={taskId}
                    withBorder
                    padding="sm"
                    style={{ borderColor: '#e1e0dc', background: '#fdfcf9' }}
                  >
                    <Group justify="space-between" align="center" mb={4}>
                      <Text>{name}</Text>
                      <Group gap="xs" align="center">
                        <Text c={color} fw={700} size="sm">
                          {status}
                        </Text>
                        {error && (
                          <Text c="red" size="sm">
                            {error}
                          </Text>
                        )}
                      </Group>
                    </Group>
                    {(taskLogs[taskId] || status === 'running') && (
                      <Box
                        component="pre"
                        style={{
                          margin: 0,
                          padding: '8px',
                          background: '#fff',
                          border: '1px solid #e1e0dc',
                          borderRadius: 6,
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'Menlo, monospace',
                          fontSize: 12,
                          color: '#111',
                        }}
                      >
                        {taskLogs[taskId] || '出力待ち...'}
                      </Box>
                    )}
                  </Card>
                );
              })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export function HomePage() {
  const queryClient = useQueryClient();
  const autoQuery = useQuery({ queryKey: ['reposAuto'], queryFn: fetchAutoRepos });
  const manualQuery = useQuery({ queryKey: ['reposManual'], queryFn: fetchManualRepos });
  const navigate = useNavigate();

  const refreshAuto = useMutation({
    mutationFn: refreshAutoRepos,
    onSuccess: (data) => {
      sessionStorage.removeItem('hiddenAutoRepos');
      setHiddenAuto(new Set());
      queryClient.setQueryData(['reposAuto'], data);
    },
  });

  const addMutation = useMutation({
    mutationFn: (path: string) => addManualRepo(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reposManual'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRepo(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<RepoSummary[]>(['reposManual'], (prev) => (prev || []).filter((r) => r.id !== id));
      queryClient.setQueryData<RepoSummary[]>(['reposAuto'], (prev) => (prev || []).filter((r) => r.id !== id));
    },
  });

  const [hiddenAuto, setHiddenAuto] = useState<Set<string>>(() => {
    const raw = sessionStorage.getItem('hiddenAutoRepos');
    if (!raw) return new Set();
    try {
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    sessionStorage.setItem('hiddenAutoRepos', JSON.stringify(Array.from(hiddenAuto)));
  }, [hiddenAuto]);

  const allRepos = useMemo(
    () =>
      [...(autoQuery.data || []), ...(manualQuery.data || [])]
        .filter((r) => !r.name.startsWith('.'))
        .filter((r) => !(r.source === 'auto' && hiddenAuto.has(r.id))),
    [autoQuery.data, manualQuery.data, hiddenAuto]
  );

  const handlePickFolder = async () => {
    let path = '';
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        // ブラウザから絶対パスは取得できないため、ユーザーに手入力を促す
        path = window.prompt('追加するフォルダの絶対パスを入力してください', handle.name) || '';
      } catch (err) {
        return;
      }
    } else {
      path = window.prompt('追加するフォルダの絶対パスを入力してください', '') || '';
    }
    if (path) addMutation.mutate(path);
  };

  if (autoQuery.isLoading || manualQuery.isLoading) {
    return (
      <Box p="lg" style={{ background: '#faf7ef', minHeight: '100vh' }}>
        <Loader />
      </Box>
    );
  }

  return (
    <Box p="lg" style={{ background: '#faf7ef', minHeight: '100vh' }}>
      <Stack gap="sm" align="center" mb="md">
        <Title order={1} style={{ letterSpacing: '0.04em', fontSize: '3rem' }}>
          codex-review
        </Title>
        <Group justify="space-between" style={{ width: '100%', maxWidth: 1200 }} align="flex-start">
          <Title order={3} style={{ letterSpacing: '0.03em' }}>
            プロジェクト一覧
          </Title>
          <Group gap="xs">
            <Button
              variant="outline"
              color="dark"
              onClick={handlePickFolder}
              loading={addMutation.isPending}
            >
              ＋ フォルダを選択
            </Button>
            <Button
              variant="outline"
              color="dark"
              onClick={() => refreshAuto.mutate()}
              loading={refreshAuto.isPending}
            >
              再スキャン
            </Button>
          </Group>
        </Group>
      </Stack>

      {addMutation.error && (
        <Alert color="red" mt="md" title="追加に失敗しました">
          {(addMutation.error as Error).message}
        </Alert>
      )}

      <Grid gutter="md" mt="md">
        {allRepos.map((repo) => (
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }} key={repo.id}>
            <RepoCard
              repo={repo}
              onClick={(r) => navigate(`/repo/${r.id}`)}
              onDelete={(r) => {
                deleteMutation.mutate(r.id);
                if (r.source === 'auto') setHiddenAuto((prev) => new Set([...prev, r.id]));
              }}
            />
          </Grid.Col>
        ))}
      </Grid>

      {!allRepos.length && (
        <Text mt="lg" c="dimmed">
          リポジトリが見つかりません。フォルダを選択して追加するか、再スキャンしてください。
        </Text>
      )}
    </Box>
  );
}

export function RepoPage() {
  const { id } = useParams<{ id: string }>();
  const autoQuery = useQuery({ queryKey: ['reposAuto'], queryFn: fetchAutoRepos });
  const manualQuery = useQuery({ queryKey: ['reposManual'], queryFn: fetchManualRepos });
  const navigate = useNavigate();

  const repo = useMemo(() => {
    const all = [...(autoQuery.data || []), ...(manualQuery.data || [])];
    return all.find((r) => r.id === id);
  }, [autoQuery.data, manualQuery.data, id]);

  if (autoQuery.isLoading || manualQuery.isLoading) {
    return (
      <Box p="lg" style={{ background: '#faf7ef', minHeight: '100vh' }}>
        <Loader />
      </Box>
    );
  }

  if (!repo) {
    return (
      <Box p="lg" style={{ background: '#faf7ef', minHeight: '100vh' }}>
        <Alert color="red" title="リポジトリが見つかりません">
          一覧に戻って再度選択してください。
        </Alert>
        <Button mt="md" variant="outline" color="dark" onClick={() => navigate('/')}>一覧に戻る</Button>
      </Box>
    );
  }

  return <BranchView repo={repo} onBack={() => navigate('/')} />;
}
