import json

data = {
    "name": "Bahus: Final PDF Workflow",
    "nodes": [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "bakhus-pdf-import",
                "responseMode": "responseNode",
                "options": {
                    "allowedOrigins": "*"
                }
            },
            "id": "673273e5-8abf-48f9-a992-676a9b39cafb",
            "name": "Webhook: PDF Entry",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [0, 200],
            "webhookId": "bakhus-pdf-import"
        },
        {
            "parameters": {
                "jsCode": "const body = $input.item.json.body || $input.item.json;
const file = $input.item.binary?.file;
const importId = body.import_batch_id || body.import_id || body.quote_id || `IMP_${Date.now()}`;
const jobId = body.job_id || `job_${Date.now()}`;
const successUrl = body.callbackSuccessUrl || body.callbacks?.success_url || 'http://host.docker.internal:8078/api/webhooks/n8n/import-result';
return {
  json: {
    importId,
    jobId,
    filename: file?.fileName || 'document.pdf',
    callbackSuccessUrl: successUrl,
    source_format: 'pdf'
  },
  binary: $input.item.binary
};"
            },
            "id": "2a353848-d6c8-4618-bf95-2ee6e15049bc",
            "name": "Metadata & Validation",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [220, 200]
        },
        {
            "parameters": {
                "method": "POST",
                "url": "https://api.openai.com/v1/chat/completions",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {
                            "name": "Authorization",
                            "value": "={{ "Bearer " + $env.OPENAI_API_KEY }}"
                        }
                    ]
                },
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "{"model": "gpt-4o-mini", "messages": [{"role": "system", "content": "Extract wine data to JSON rows."}, {"role": "user", "content": "Process the document."}]}"
            },
            "id": "328e9d99-5d80-4002-9ac1-d1da54c87b19",
            "name": "OpenAI: Parse",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4,
            "position": [440, 200]
        },
        {
            "parameters": {
                "jsCode": "const response = $input.item.json;
const meta = $("Metadata & Validation").first().json;
return {
  json: {
    import_batch_id: meta.importId,
    job_id: meta.jobId,
    status: "parsed",
    rows: [],
    callbackSuccessUrl: meta.callbackSuccessUrl
  }
};"
            },
            "id": "5edbf57f-7a2b-45ad-92c8-b137a0a8f562",
            "name": "Format",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [660, 200]
        },
        {
            "parameters": {
                "method": "POST",
                "url": "={{ $json.callbackSuccessUrl }}",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ $json }}"
            },
            "id": "6b566530-6873-472c-a6ed-49f53ce7aaba",
            "name": "Callback",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4,
            "position": [880, 200]
        }
    ],
    "connections": {
        "Webhook: PDF Entry": {
            "main": [
                [
                    {
                        "node": "Metadata & Validation",
                        "type": "main",
                        "index": 0
                    }
                ]
            ]
        },
        "Metadata & Validation": {
            "main": [
                [
                    {
                        "node": "OpenAI: Parse",
                        "type": "main",
                        "index": 0
                    }
                ]
            ]
        },
        "OpenAI: Parse": {
            "main": [
                [
                    {
                        "node": "Format",
                        "type": "main",
                        "index": 0
                    }
                ]
            ]
        },
        "Format": {
            "main": [
                [
                    {
                        "node": "Callback",
                        "type": "main",
                        "index": 0
                    }
                ]
            ]
        }
    }
}

with open("/Users/alexanderliapustin/Desktop/Bahus/n8n/bahus_final_workflow.json", "w") as f:
    json.dump(data, f, indent=2)
