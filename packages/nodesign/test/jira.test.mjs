import assert from "node:assert/strict";
import {
  extractDesignLinksFromText,
  inspectJiraTaskText,
  inspectJiraContext,
} from "../dist/index.js";

try {
  const sampleJiraText = `
  Task: ANDROID-123 Checkout Redesign
  Description:
  Please update the checkout screen UI according to the Zeplin design:
  https://zpl.io/AOGOKp6

  Also check the Figma specs here:
  https://www.figma.com/design/tVN4mWwBlUlzWNUZGfaavK/Tindahang-Tapat?node-id=16219-6561

  Duplicate link should be deduplicated:
  https://zpl.io/AOGOKp6.
  `;

  const links = extractDesignLinksFromText(sampleJiraText);
  assert.equal(links.length, 2);
  assert.equal(links[0].provider, "zeplin");
  assert.equal(links[0].url, "https://zpl.io/AOGOKp6");
  assert.equal(links[1].provider, "figma");
  assert.equal(links[1].url, "https://www.figma.com/design/tVN4mWwBlUlzWNUZGfaavK/Tindahang-Tapat?node-id=16219-6561");

  const inspection = inspectJiraTaskText(sampleJiraText);
  assert.equal(inspection.designLinks.length, 2);
  assert(inspection.notes[0].includes("Discovered 2 design link(s)"));

  const emptyInspection = inspectJiraTaskText("No design links here");
  assert.equal(emptyInspection.designLinks.length, 0);
  assert(emptyInspection.notes[0].includes("No direct Zeplin, Figma, or attachment design links found"));

  const jsonJiraWithAttachments = JSON.stringify({
    key: "S3-6345",
    fields: {
      description: "No zeplin link in description",
      attachment: [
        { filename: "Screenshot_1.png", content: "https://jira/attachment/1" },
        { filename: "Screenshot_2.png", content: "https://jira/attachment/2" },
      ],
      customfield_10058: [
        { displayName: "Figma Flow", url: "https://www.figma.com/file/ABC?node-id=1-2" },
      ],
    },
  });

  const jsonInspection = inspectJiraTaskText(jsonJiraWithAttachments);
  assert.equal(jsonInspection.designLinks.length, 3);
  assert.equal(jsonInspection.designLinks[0].provider, "figma");
  assert.equal(jsonInspection.designLinks[1].provider, "other");
  assert.equal(jsonInspection.designLinks[1].label, "Attachment: Screenshot_1.png");

  const unknownContext = inspectJiraContext("unknown");
  assert.equal(unknownContext.designLinks.length, 0);
  assert.equal(unknownContext.notes[0], "No Jira issue ID provided");

  console.log("nodesign jira test ok");
} catch (err) {
  console.error("nodesign jira test failed:", err);
  process.exit(1);
}
