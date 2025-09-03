import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { fetchAI } from '../clientCalls';
import { stripThinkBlocks, stripHtmlTags } from '../utils/textActions';
import styled from 'styled-components';
type EditorProps = {
	onOpenPreview: (original: string, suggestion: string, applyFn: () => void) => void;
	model: string;
	modelSelector?: React.ReactNode;
};

function useSelectionIn(elRef: React.RefObject<HTMLDivElement | null>) {
	const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
	const [text, setText] = useState('');
	useEffect(() => {
		function onSel() {
			const sel = window.getSelection();
			if (!sel || sel.rangeCount === 0) { setRect(null); setText(''); return; }
			const range = sel.getRangeAt(0);
			const container = elRef.current;
			if (!container || !container.contains(range.commonAncestorContainer)) {
				setRect(null); setText(''); return;
			}
			const r = range.getBoundingClientRect();
			const t = sel.toString();
			if (t.trim().length > 0) {
				setRect({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width });
				setText(t);
			} else {
				setRect(null); setText('');
			}
		}
		document.addEventListener('selectionchange', onSel);
		return () => document.removeEventListener('selectionchange', onSel);
	}, [elRef]);
	return { rect, text };
}

async function callAI({ selection, action, model }: { selection: string; action: string; model: string }) {
	// Use fetchAI from clientCalls for consistency and streaming support
	// Import at top: import { fetchAI } from '../clientCalls';
	let fullText = '';
	await fetchAI({
		selection,
		action,
		model,
		onStream: (chunk: string) => {
			fullText += chunk;
		}
	});
	let text = fullText.replace(/\*\*/g, '').trim();
	if (action === 'table') {
		text = text
			.split('\n')
			.map((line: string) => line.replace(/\s*\|\s*/g, ' | ').trim())
			.filter((line: string) => line.length > 0)
			.join('\n');
	}
	if (action === 'shorten' || action === 'lengthen') {
		text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
	}
	// Format code blocks for readability
	text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
		return '\n' + code.trim().split('\n').map((line: string) => '    ' + line).join('\n') + '\n';
	});
	return text;
}

const Editor = forwardRef<any, EditorProps>(function Editor({ onOpenPreview, model, modelSelector }, ref) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const editorRef = useRef<HTMLDivElement | null>(null);
	const lastRangeRef = useRef<Range | null>(null);
	const { rect, text } = useSelectionIn(editorRef);

	useEffect(() => {
		function storeRange() {
			const sel = window.getSelection();
			if (sel && sel.rangeCount) {
				const r = sel.getRangeAt(0).cloneRange();
				lastRangeRef.current = r;
			}
		}
		document.addEventListener('selectionchange', storeRange);
		return () => document.removeEventListener('selectionchange', storeRange);
	}, []);

	useImperativeHandle(ref, () => ({
		getText() {
			return editorRef.current?.innerText || '';
		},
		insertAtCursor(txt: string) {
			const el = editorRef.current;
			if (!el) return;
			el.focus();
			const sel = window.getSelection();
			// If editor is empty, set its content directly
			if (!el.innerText.trim()) {
				el.innerText = txt;
				return;
			}
			if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
				const r = sel.getRangeAt(0);
				r.deleteContents();
				r.insertNode(document.createTextNode(txt));
				r.collapse(false);
				sel.removeAllRanges();
				sel.addRange(r);
			} else {
				// If no selection, append text and scroll into view
				el.appendChild(document.createTextNode('\n' + txt));
				el.scrollIntoView({ behavior: 'smooth', block: 'end' });
			}
		}
	}), []);

	const openAction = async (action: string) => {
		if (!text) return;
		const suggestion = await callAI({ selection: text, action, model });
		const applyFn = () => {
			let formatted = suggestion.replace(/\*\*/g, '');
			formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
				return '\n' + code.trim().split('\n').map((line: string) => '    ' + line).join('\n') + '\n';
			});
			// Remove duplicate lines from editor
			const el = editorRef.current;
			if (!el) return;
			const currentText = el.innerText;
			const formattedLines = formatted.split('\n').map(l => l.trim()).filter(l => l.length > 0);
			const currentLines = currentText.split('\n').map(l => l.trim());
			const uniqueLines = formattedLines.filter(line => !currentLines.includes(line));
			const resultText = uniqueLines.join('\n');
			el.innerText = resultText;
			// If selection exists, try to replace selection as well (for best UX)
			if (lastRangeRef.current) {
				const sel = window.getSelection();
				sel?.removeAllRanges();
				sel?.addRange(lastRangeRef.current);
				const r = window.getSelection()?.getRangeAt(0) || lastRangeRef.current;
				if (r) {
					r.deleteContents();
					r.insertNode(document.createTextNode(resultText));
				}
			}
		};
		onOpenPreview(text, suggestion, applyFn);
	};

		return (
			<>
				<Header>
					<span>Live Editor (local Ollama)</span>
					{modelSelector && <span style={{ float: 'right' }}>{modelSelector}</span>}
				</Header>
				<Holder ref={containerRef}>
					{rect && (
						<Bar style={{ top: rect.top - 4, left: rect.left }}>
							{[
								{ action: 'shorten', label: 'Shorten' },
								{ action: 'lengthen', label: 'Lengthen' },
								{ action: 'table', label: 'Convert to table' }
							].map(({ action, label }) => (
								<Btn key={action} onClick={() => openAction(action)}>
									{label}
								</Btn>
							))}
						</Bar>
					)}
					<Paper
						ref={editorRef}
						contentEditable
						suppressContentEditableWarning
						spellCheck={false}
					>
						Welcome! Type some text, select it, then choose an AI action above.
					</Paper>
				</Holder>
			</>
		);
	});

export default Editor;



const Bar = styled.div`
	position: absolute;
	top: 0;
	left: 0;
    width: 20%;
    height: 44px;
	padding: 18px 24px;
	// background: rgba(30, 41, 59, 0.55);
	backdrop-filter: blur(12px);
	// border: 1.5px solid #00eaff;
	border-radius: 18px;
	box-shadow: 0 8px 32px 0 rgba(7, 27, 28, 0.18), 0 1.5px 8px rgba(0,0,0,0.10);
	display: flex;
	gap: 5px;
	align-items: center;
	z-index: 30;
	transition: box-shadow 0.2s;
`;
const Btn = styled.button`
	padding: 8px 16px;
	border-radius: 12px;
	cursor: pointer;
	font-weight: 600;
	letter-spacing: 0.5px;
	font-size: 13px;
	border: none;
	background: linear-gradient(135deg, rgba(67, 206, 162, 0.9) 0%, rgba(0, 234, 255, 0.9) 100%);
	color: #fff;
	box-shadow: 0 4px 15px rgba(0, 234, 255, 0.2);
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	outline: none;
	backdrop-filter: blur(10px);
	border: 1px solid rgba(255, 255, 255, 0.2);
	position: relative;
	overflow: hidden;
	
	&:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow: 0 8px 25px rgba(0, 234, 255, 0.3);
		background: linear-gradient(135deg, rgba(67, 206, 162, 1) 0%, rgba(0, 234, 255, 1) 100%);
	}
	
	&:active {
		transform: translateY(0) scale(0.98);
	}
	
	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transform: translateX(-100%);
		transition: transform 0.6s;
	}
	
	&:hover::before {
		transform: translateX(100%);
	}
`;

const Header = styled.div`
	padding: 16px 20px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	font-weight: 700;
	font-size: 20px;
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
	color: #fff;
	letter-spacing: 0.5px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	backdrop-filter: blur(20px);
	text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
	position: relative;
	
	&::before {
		content: '✨';
		position: absolute;
		left: 20px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 22px;
	}
	
	& > span:first-child {
		margin-left: 40px;
	}
`;

const Holder = styled.div`
	padding: 20px;
	flex: 1;
	min-height: 0;
	overflow: auto;
	position: relative;
	background: linear-gradient(135deg, rgba(142, 45, 226, 0.1) 0%, rgba(74, 0, 224, 0.1) 100%);
	display: flex;
	flex-direction: column;
	backdrop-filter: blur(10px);
`;

const Paper = styled.div`
	background: rgba(255, 255, 255, 0.95);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 16px;
	padding: 24px;
	min-height: 300px;
	max-height: 100%;
	outline: none;
	overflow-y: auto;
	word-break: break-word;
	font-size: 16px;
	line-height: 1.6;
	color: #1a1a1a;
	box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
	backdrop-filter: blur(20px);
	transition: all 0.2s ease;
	
	&:hover {
		box-shadow: 0 15px 50px rgba(0, 0, 0, 0.15);
		transform: translateY(-2px);
	}
	
	&:focus {
		border-color: rgba(0, 245, 255, 0.4);
		box-shadow: 0 0 0 3px rgba(0, 245, 255, 0.1), 0 15px 50px rgba(0, 0, 0, 0.15);
	}
	
	&::-webkit-scrollbar {
		width: 6px;
	}
	
	&::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.05);
		border-radius: 3px;
	}
	
	&::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 3px;
		
		&:hover {
			background: rgba(0, 0, 0, 0.3);
		}
	}
`;

