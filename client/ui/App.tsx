import React, { useRef, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import Editor from './Editor';
import Chat from './Chat';
import PreviewModal from './PreviewModal';

const models = [
	{ name: 'llama3.2:latest', label: 'Llama 3.2' },
	{ name: 'qwen2.5-coder:1.5b', label: 'Qwen 2.5 Coder' },
	{ name: 'deepseek-r1:1.5b', label: 'DeepSeek R1' }
];

export default function App() {
	const editorRef = useRef<any>(null);
	const [preview, setPreview] = useState<{ open: boolean; original: string; suggestion: string; apply: () => void; loading?: boolean }>({ open: false, original: '', suggestion: '', apply: () => {}, loading: false });
	const [model, setModel] = useState<string>(models[0].name);
	// Fixed chat width
	const chatWidth = 320;

	return (
		<>
			<GlobalStyle />
			<SplitPane>
				<Pane>
					<Editor
						ref={editorRef}
						model={model}
						onOpenPreview={(original, suggestion, applyFn, opts) => setPreview({ open: true, original, suggestion, apply: applyFn, loading: opts?.loading })}
						modelSelector={
							<ModelSelector>
								<ModelLabel>LLM Variant:</ModelLabel>
								<ModelSelect value={model} onChange={e => setModel(e.target.value)}>
									{models.map(m => <option key={m.name} value={m.name}>{m.label}</option>)}
								</ModelSelect>
							</ModelSelector>
						}
					/>
				</Pane>
				{/* DragBar removed, panes are fixed */}
				<Pane $right style={{ flexBasis: chatWidth, maxWidth: chatWidth, minWidth: chatWidth }}>
					<Chat
						getDoc={() => editorRef.current?.getText() || ''}
						applyToEditor={(text: string) => editorRef.current?.insertAtCursor(text)}
						model={model}
					/>
				</Pane>
			</SplitPane>
				<PreviewModal
					open={preview.open}
					original={preview.original}
					suggestion={preview.suggestion}
					loading={!!preview.loading}
					onCancel={() => setPreview(p => ({ ...p, open: false }))}
					onConfirm={async () => {
						// Always send suggestion to editor block
						if (editorRef.current) {
							editorRef.current.insertAtCursor(preview.suggestion);
						}
						setPreview(p => ({ ...p, open: false }));
					}}
				/>
		</>
	);
}

const GlobalStyle = createGlobalStyle`
	:root { color-scheme: light dark; }
	* { box-sizing: border-box; }
	html, body, #root { height: 100%; margin: 0; }
	body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji; }
`;

const SplitPane = styled.div`
	height: 100%;
	display: flex;
	width: 100%;
`;
const Pane = styled.div<{ $right?: boolean }>`
	height: 100%;
	display: flex;
	flex-direction: column;
	flex: ${p => p.$right ? '0 0 var(--chat-width,320px)' : '1 1 0%'};
	border-left: ${p => p.$right ? '1px solid #6c7274ff' : 'red'};
	min-width: 120px;
	transition: flex-basis 0.2s;
`;

const ModelSelector = styled.span`
	margin-left: 16px;
	display: flex;
	align-items: center;
	width: 100%;
`;

const ModelLabel = styled.span`
	font-weight: 500;
	color: #1c3a3cff;
	margin-right: 8px;
`;

const ModelSelect = styled.select`
	font-size: 15px;
	padding: 2px 10px;
	border-radius: 8px;
	height: 30px;
	background: linear-gradient(90deg, #43cea2 0%, #1d2f31ff 100%);

`;


