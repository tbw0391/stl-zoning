import { deleteNote, updateNote } from "@/app/projects/actions";

// Edit link on a project note (suggestion #31): opens a box to reword it, with Delete tucked inside so a stray click
// can't remove a note.
export default function NoteEdit({ id, body }: { id: number; body: string }) {
  return (
    <details className="todo-edit note-edit">
      <summary className="link">Edit</summary>
      {/* Keyed on the text so the box shows the saved wording after a save. */}
      <form key={body} action={updateNote.bind(null, id)} className="stack-form">
        <textarea name="body" rows={3} required defaultValue={body} />
        <div className="note-edit-actions">
          <button type="submit">Save</button>
          <button type="submit" formAction={deleteNote.bind(null, id)} className="link danger">Delete note</button>
        </div>
      </form>
    </details>
  );
}
