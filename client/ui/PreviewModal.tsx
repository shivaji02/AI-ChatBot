import React from 'react'
import styled from 'styled-components'
interface CardProps {
  ai?: boolean;
}

import { useState } from 'react'

interface PreviewModalProps {
  open: boolean;
  original: string;
  suggestion: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export default function PreviewModal({ open, original, suggestion, onCancel, onConfirm }: PreviewModalProps) {
  const [performing, setPerforming] = useState(false)
  if (!open) return null
  return (
    <Back>
      <Box>
        <Title>Preview: Original vs AI Suggestion</Title>
        <Grid>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginBottom: 6, letterSpacing: 1 }}>📝 Original</div>
            <Card style={{ fontSize: 16, color: '#059669', background: 'linear-gradient(90deg, #e6ffed 0%, #b2f7ef 100%)' }}>{original || '(empty selection)'}</Card>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2563eb', marginBottom: 6, letterSpacing: 1 }}>🤖 AI Suggestion</div>
            <Card ai style={{ fontSize: 16, color: '#2563eb', background: 'linear-gradient(90deg, #e3f0ff 0%, #b2d8ff 100%)' }}>{suggestion || '(no suggestion)'}</Card>
          </div>
        </Grid>
        <Row>
          <Btn
            onClick={onCancel}
            disabled={performing}
            style={{ background: '#fff', color: '#111827', borderColor: '#111827', fontWeight: 600, borderWidth: 2, marginRight: 8, minWidth: 100 }}
          >
            Cancel
          </Btn>
          <Btn
            onClick={async () => {
              setPerforming(true)
              await onConfirm()
              setPerforming(false)
            }}
            style={{ background: '#111827', color: 'white', borderColor: '#111827', position: 'relative', fontWeight: 600, minWidth: 100 }}
            disabled={performing}
          >
            {performing ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 16, height: 16, border: '2px solid #2563eb', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }}></span>
                Performing...
              </span>
            ) : 'Confirm'}
          </Btn>
        </Row>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </Box>
    </Back>
  )
}



const Back = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; z-index: 50;
`
const Box = styled.div`
  background: white; width: min(860px, 96vw); border: 1px solid #352a0dff; border-radius: 16px; padding: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
`
const Title = styled.div`
  font-weight: 600; margin-bottom: 10px;
`
const Grid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`

const Card = styled.div<CardProps>`
  background: ${p => p.ai ? '#e3f0ff' : '#e6ffed'};
  border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; white-space: pre-wrap; word-break: break-word;
  max-height: 340px;
  overflow: auto;
`
const Row = styled.div`
  margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;
`
const Btn = styled.button`
  padding: 8px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer;
  &:hover { background: #f8fafc; }
`
