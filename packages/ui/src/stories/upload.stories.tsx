import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { FileDropzone } from "../components/file-dropzone";

// Portal 13-documents and 23-desktop-d-documents.
const onFiles = fn();
const meta: Meta<typeof FileDropzone> = { title: "Product/FileDropzone", component: FileDropzone, parameters: { layout: "padded" }, args: { onFiles, label: "Upload your W-2" } };
export default meta;
type Story = StoryObj<typeof FileDropzone>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const input = canvasElement.querySelector("input[type=file]") as HTMLInputElement;
    await step("a PDF is taken", async () => {
      await userEvent.upload(input, new File(["%PDF-1.7 demo"], "w2-demo.pdf", { type: "application/pdf" }));
      await expect(onFiles).toHaveBeenCalledOnce();
      await expect(onFiles.mock.lastCall?.[0][0].name).toBe("w2-demo.pdf");
      await expect(c.queryByRole("alert")).toBeNull();
    });
    await step("anything else says what's wrong, in words", async () => {
      await userEvent.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }), { applyAccept: false });
      await expect(c.getByRole("alert")).toHaveTextContent("notes.txt isn't a PDF, JPG, PNG or HEIC file.");
      await expect(onFiles).toHaveBeenCalledOnce();
    });
  },
};
export const Disabled: Story = { args: { disabled: true } };
