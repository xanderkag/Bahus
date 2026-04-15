import json

with open("n8n/bahus_final_workflow.json", "r") as f:
    data = json.load(f)

for node in data.get("nodes", []):
    if node.get("name") == "Metadata & Validation":
        # Make the parsing robust
        node["parameters"]["jsCode"] = """const body = $input.item.json.body || $input.item.json || {};
const file = $input.item.binary?.file || $input.item.binary?.data;
const source = body.source || 'import';
const importId = body.import_batch_id || body.import_id || body.quote_id || `IMP_${Date.now()}`;
const jobId = body.job_id || `job_${Date.now()}`;

// Extract URL exactly as provided by our backend proxy or front-end actions
const successUrl = body.callbackSuccessUrl || body.callbacks?.success_url;
const failedUrl = body.callbackFailedUrl || body.callbacks?.failed_url;

if (!successUrl) {
  throw new Error("Missing callbackSuccessUrl in webhook payload! Please make sure your Bakhus UI/backend is sending it correctly.");
}

return {
  json: {
    importId,
    jobId,
    filename: file?.fileName || 'document.pdf',
    callbackSuccessUrl: successUrl,
    callbackFailedUrl: failedUrl,
    source,
    source_format: 'pdf'
  },
  binary: $input.item.binary
};"""

with open("n8n/bahus_final_workflow.json", "w") as f:
    json.dump(data, f, indent=2)
