const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/Users/alexanderliapustin/Desktop/Bahus/n8n/bahus_workflow_v2.json', 'utf8'));

// 1. Remove old nodes
data.nodes = data.nodes.filter(n => n.name !== 'Extract PDF1' && n.name !== 'OpenAI: Parse2');

// 2. Add new node
const codeScript = `
const meta = $("Metadata & Validation2").first().json;
const openaiKey = $env.OPENAI_API_KEY;
if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

const binaryData = await this.helpers.getBinaryDataBuffer(0, 'file');
const fileName = $input.item.binary.file.fileName || 'document.pdf';

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const header = \`--\${boundary}\\r\\nContent-Disposition: form-data; name="purpose"\\r\\n\\r\\nassistants\\r\\n--\${boundary}\\r\\nContent-Disposition: form-data; name="file"; filename="\${fileName}"\\r\\nContent-Type: application/pdf\\r\\n\\r\\n\`;
const footer = \`\\r\\n--\${boundary}--\\r\\n\`;

const body = Buffer.concat([
  Buffer.from(header, 'utf8'),
  binaryData,
  Buffer.from(footer, 'utf8')
]);

let uploadRes;
try {
  const result = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://api.openai.com/v1/files',
    headers: {
      'Authorization': \`Bearer \${openaiKey}\`,
      'Content-Type': \`multipart/form-data; boundary=\${boundary}\`
    },
    body: body,
    encoding: null 
  });
  uploadRes = typeof result === 'string' ? JSON.parse(result) : result;
} catch(e) {
  throw new Error("File upload failed: " + (e.message || e));
}

const fileId = uploadRes.id;
let assistantId = null;

try {
  const prompt = \`You are a master data extractor. Extract all items from the attached document into a JSON object. Ensure the format is exactly {"rows": [ { "name": "...", "article": "...", "qty": 1, "purchase_price": 100, "volume_l": 0.75, "country": "...", "category": "...", "note": "..." } ] }. Respond ONLY with a valid JSON object.\`;
  
  const assistantResStr = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://api.openai.com/v1/assistants',
    headers: {
      'Authorization': \`Bearer \${openaiKey}\`,
      'OpenAI-Beta': 'assistants=v2',
      'Content-Type': 'application/json'
    },
    body: {
      name: 'PDF Extractor Temp',
      model: 'gpt-4o',
      instructions: prompt,
      tools: [{ type: "file_search" }],
      tool_resources: { file_search: { vector_stores: [{ file_ids: [fileId] }] } }
    }
  });
  const assistantRes = typeof assistantResStr === 'string' ? JSON.parse(assistantResStr) : assistantResStr;
  assistantId = assistantRes.id;

  const runResStr = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://api.openai.com/v1/threads/runs',
    headers: {
      'Authorization': \`Bearer \${openaiKey}\`,
      'OpenAI-Beta': 'assistants=v2',
      'Content-Type': 'application/json'
    },
    body: {
      assistant_id: assistantId,
      response_format: { type: "json_object" }
    }
  });
  const runRes = typeof runResStr === 'string' ? JSON.parse(runResStr) : runResStr;

  const threadId = runRes.thread_id;
  let runId = runRes.id;

  let status = runRes.status;
  while (status === "queued" || status === "in_progress") {
    await new Promise(r => setTimeout(r, 4000));
    const pollResStr = await this.helpers.httpRequest({
      method: 'GET',
      url: \`https://api.openai.com/v1/threads/\${threadId}/runs/\${runId}\`,
      headers: {
        'Authorization': \`Bearer \${openaiKey}\`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    const pollRes = typeof pollResStr === 'string' ? JSON.parse(pollResStr) : pollResStr;
    status = pollRes.status;
    if (status === "failed") throw new Error(\`Run failed\`);
  }

  const msgsResStr = await this.helpers.httpRequest({
    method: 'GET',
    url: \`https://api.openai.com/v1/threads/\${threadId}/messages\`,
    headers: {
      'Authorization': \`Bearer \${openaiKey}\`,
      'OpenAI-Beta': 'assistants=v2'
    }
  });
  const msgsRes = typeof msgsResStr === 'string' ? JSON.parse(msgsResStr) : msgsResStr;
  
  await this.helpers.httpRequest({ method: 'DELETE', url: \`https://api.openai.com/v1/assistants/\${assistantId}\`, headers: {'Authorization': \`Bearer \${openaiKey}\`, 'OpenAI-Beta': 'assistants=v2'} }).catch(()=>{});
  await this.helpers.httpRequest({ method: 'DELETE', url: \`https://api.openai.com/v1/files/\${fileId}\`, headers: {'Authorization': \`Bearer \${openaiKey}\`} }).catch(()=>{});

  const contentBlock = msgsRes.data[0].content.find(c => c.type === 'text');
  let rawText = contentBlock ? contentBlock.text.value : '{"rows":[]}';
  
  return { json: { choices: [ { message: { content: rawText } } ] } };

} catch(e) {
  if (assistantId) await this.helpers.httpRequest({ method: 'DELETE', url: \`https://api.openai.com/v1/assistants/\${assistantId}\`, headers: {'Authorization': \`Bearer \${openaiKey}\`, 'OpenAI-Beta': 'assistants=v2'} }).catch(()=>{});
  await this.helpers.httpRequest({ method: 'DELETE', url: \`https://api.openai.com/v1/files/\${fileId}\`, headers: {'Authorization': \`Bearer \${openaiKey}\`} }).catch(()=>{});
  throw e;
}
`;

data.nodes.push({
  "parameters": {
    "jsCode": codeScript
  },
  "id": "assistants-api-extraction-id",
  "name": "OpenAI Assistants API",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [ 860, 420 ]
});

// 3. Update Format Success1 code
const formatNode = data.nodes.find(n => n.name === 'Format Success1');
if (formatNode) {
  formatNode.parameters.jsCode = formatNode.parameters.jsCode.replace('$("OpenAI: Parse2")', '$("OpenAI Assistants API")');
}

// 4. Clean and reroute connections
delete data.connections['Extract PDF1'];
delete data.connections['OpenAI: Parse2'];

data.connections['If: Is PDF?1'].main[0] = [
  {
    "node": "OpenAI Assistants API",
    "type": "main",
    "index": 0
  }
];

data.connections['OpenAI Assistants API'] = {
  "main": [
    [
      {
        "node": "Format Success1",
        "type": "main",
        "index": 0
      }
    ]
  ]
};

fs.writeFileSync('/Users/alexanderliapustin/Desktop/Bahus/n8n/bahus_workflow_v2.json', JSON.stringify(data, null, 2));

