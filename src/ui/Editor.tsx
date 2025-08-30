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
	padding: 1px 5px;
	border-radius: 8px;
	cursor: pointer;
	font-weight: 200;
	letter-spacing: 0.5px;
	font-size: 15px;
	border: none;
	// background: linear-gradient(90deg, #0c494fff 30%, #202a42ff 100%);
	color: #b9c5cbff;
	// padding: 10px 28px;
	border-radius: "14px";
	cursor: pointer;
	letter-spacing: 0.7px;
	box-shadow: "0 2px 12px rgba(0,238,255,0.10)";
	transition: background 0.2s, color 0.2s;
	outline: none;
	border-bottom: "2.5px solid #43cea2";
	border-top: "1.5px solid #00eaff";
	opacity: 0.95;
	backdrop-filter: blur(2px);
	&:hover {
		background: linear-gradient(90deg, #43cea2 0%, #00eaff 100%);
		color: #111827;
		opacity: 1;
	}
`;

const Header = styled.div`
	padding: 12px 16px;
	border-bottom: 1px solid #00eaff;
	font-weight: 700;
	font-size: 18px;
	background: linear-gradient(90deg, #232526 0%, #414345 100%);
	color: #00eaff;
	letter-spacing: 1px;
`;
const Holder = styled.div`
	padding: 16px;
	flex: 1;
	min-height: 0;
	overflow: auto;
	position: relative;
	background: linear-gradient(120deg, #8e2de2 0%, #4a00e0 100%);
	display: flex;
	flex-direction: column;
`;
const Paper = styled.div`
	background: linear-gradient(120deg, #f6d365 0%, #fda085 100%);
	border: 1px solid #00eaff;
	border-radius: 18px;
	padding: 24px;
	min-height: 120px;
	max-height: 100%;s
	outline: none;
	overflow-y: auto;
	word-break: break-word;
	font-size: 17px;
	color: #232526;
	box-shadow: 0 4px 24px rgba(0,0,0,0.10);
`;

