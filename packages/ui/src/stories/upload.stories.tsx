import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { FileDropzone, UploadList, useUploads, type Uploader } from "../components/file-dropzone";

// Portal 13-documents and 23-desktop-d-documents. Drop or choose files and watch each one: preview,
// progress, Uploaded (or what went wrong, with a retry). The upload here is simulated; the app's real
// uploader posts to /api/documents.

const meta: Meta = { title: "Product/FileDropzone" };
export default meta;
type Story = StoryObj;

// ~1.2s per file; any file with "blurry" in its name fails the way a real rejection would read.
const fakeUpload: Uploader = (file, onProgress) =>
  new Promise((resolve, reject) => {
    let f = 0;
    const t = setInterval(() => {
      f += 0.2;
      onProgress(f);
      if (f >= 1) {
        clearInterval(t);
        if (file.name.includes("blurry")) reject(new Error("That photo is too blurry to read. Try again in better light."));
        else resolve();
      }
    }, 240);
  });

const picked = fn();

function Uploads() {
  const u = useUploads(fakeUpload);
  return (
    <div className="grid w-[26rem] max-w-full gap-4">
      <FileDropzone
        label="Upload your W-2"
        onFiles={(files) => {
          picked(files.map((f) => f.name));
          u.start(files);
        }}
      />
      <UploadList items={u.items} announcement={u.announcement} onRetry={u.retry} onRemove={u.remove} />
    </div>
  );
}

export const Default: Story = {
  render: () => <Uploads />
};
export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const input = canvasElement.querySelector("input[type=file]") as HTMLInputElement;

    await step("a pick shows up at once, then finishes as Uploaded and is announced", async () => {
      await userEvent.upload(input, new File(["%PDF-1.7 demo"], "w2-demo.pdf", { type: "application/pdf" }));
      await expect(picked).toHaveBeenLastCalledWith(["w2-demo.pdf"]);
      await expect(c.getByRole("progressbar", { name: "Uploading w2-demo.pdf" })).toBeInTheDocument();
      await waitFor(() => expect(c.getByText("Uploaded")).toBeInTheDocument(), { timeout: 4000 });
      await expect(c.getByText("w2-demo.pdf uploaded")).toBeInTheDocument(); // the live region
    });

    await step("a photo gets a thumbnail; a failure says why and offers a retry", async () => {
      // A real 1×1 PNG, so the thumbnail actually loads.
      const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="), (ch) => ch.charCodeAt(0));
      await userEvent.upload(input, new File([png], "blurry-1099.png", { type: "image/png" }));
      const row = c.getByText("blurry-1099.png").closest("li")!;
      await waitFor(() => expect((row.querySelector("img") as HTMLImageElement | null)?.naturalWidth).toBe(1));
      await waitFor(() => expect(within(row).getByText(/too blurry to read/)).toBeInTheDocument(), { timeout: 4000 });
      await expect(within(row).getByRole("button", { name: "Try blurry-1099.png again" })).toBeInTheDocument();
    });

    await step("a file type we can't take never starts", async () => {
      await userEvent.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }), { applyAccept: false });
      await expect(c.getByRole("alert")).toHaveTextContent("notes.txt isn't a PDF, JPG, PNG or HEIC file.");
      await expect(c.queryByText("notes.txt", { selector: "li *" })).toBeNull();
    });
  },
};


export const Disabled: Story = { render: () => <div className="w-[26rem]"><FileDropzone onFiles={() => {}} disabled /></div> };
