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
	const [preview, setPreview] = useState<{ open: boolean; original: string; suggestion: string; apply: () => void }>({ open: false, original: '', suggestion: '', apply: () => {} });
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
						onOpenPreview={(original, suggestion, applyFn) => setPreview({ open: true, original, suggestion, apply: applyFn })}
						modelSelector={
							<ModelSelector>
								<ModelLabel>Ollama Model:</ModelLabel>
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

// --- Styles ---
const GlobalStyle = createGlobalStyle`
	:root { color-scheme: light dark; }
	* { box-sizing: border-box; }
	html, body, #root { height: 100%; margin: 0; }
	body { 
		font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; 
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		overflow: hidden;
	}
`;

const SplitPane = styled.div`
	height: 100vh;
	display: flex;
	width: 100%;
	backdrop-filter: blur(20px);
	background: rgba(255, 255, 255, 0.05);
	border-radius: 20px;
	margin: 10px;
	box-shadow: 0 25px 45px rgba(0, 0, 0, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.1);
	overflow: hidden;
`;

const Pane = styled.div<{ $right?: boolean }>`
	height: 100%;
	display: flex;
	flex-direction: column;
	flex: ${p => p.$right ? '0 0 var(--chat-width,320px)' : '1 1 0%'};
	border-left: ${p => p.$right ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'};
	min-width: 120px;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	backdrop-filter: blur(10px);
`;

const ModelSelector = styled.span`
	margin-left: 16px;
	display: flex;
	align-items: center;
	background: rgba(255, 255, 255, 0.1);
	padding: 8px 12px;
	border-radius: 12px;
	backdrop-filter: blur(10px);
	border: 1px solid rgba(255, 255, 255, 0.2);
`;

const ModelLabel = styled.span`
	font-weight: 600;
	color: #00f5ff;
	margin-right: 8px;
	text-shadow: 0 0 10px rgba(0, 245, 255, 0.3);
`;

const ModelSelect = styled.select`
	font-size: 14px;
	padding: 6px 12px;
	border-radius: 10px;
	border: 1px solid rgba(255, 255, 255, 0.2);
	background: rgba(255, 255, 255, 0.1);
	color: #fff;
	backdrop-filter: blur(10px);
	font-weight: 500;
	cursor: pointer;
	transition: all 0.2s ease;
	
	&:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}
	
	&:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.4);
	}
	
	option {
		background: #2a2a3a;
		color: #fff;
		padding: 8px;
	}
`;


// Styled-components moved to the bottom

