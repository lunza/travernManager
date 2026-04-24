import React from 'react';
import { Editor, useEditor } from '@milkdown/react';
import { nord } from '@milkdown/theme-nord';
import { commonmark } from '@milkdown/preset-commonmark';

const TestPage: React.FC = () => {
  const editor = useEditor({
    config: (ctx) => {
      ctx.update(nord, { origin: 'user' });
    },
    plugins: [
      nord,
      commonmark
    ]
  });

  return (
    <div className="test-page" style={{ padding: '20px' }}>
      <h1 style={{ marginBottom: '20px' }}>Milkdown 富文本编辑测试</h1>
      <div 
        style={{ 
          border: '1px solid #d9d9d9', 
          borderRadius: '4px', 
          minHeight: '400px',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.09)'
        }}
      >
        <Editor editor={editor} />
      </div>
    </div>
  );
};

export default TestPage;