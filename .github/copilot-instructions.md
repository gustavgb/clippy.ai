# holger.ai

In this project I will be creating a local-first bookmarking/research tool with built in notetaking capabilities. It is called **holger.ai**.

## Tech stack

- Tauri V2
- Svelte
- Code Mirror 6
- Tailwind + DaisyUI

## Data Storage

Data will be stored in a JSON file on the user's file system. It will have the following interface:

```ts
interface Data {
  idCounter: number;
  projects: {
    id: number;
    title: string;
    note: string;
    bookmarks: string[]
    lastUpdated: string;
  }[];
  bookmarks: {
    id: number;
    title: string;
    note: string;
    tags: string[];
    lastUpdated: string;
  };
}
```

## Design

The user interface must be very simple. At the top are two tabs: bookmarks and projects

### Bookmarks page

At the top there is a searchbar on the left and on the right is a button to add a new bookmark. Below is a list of existing bookmarks on the left and possibly the opened bookmark on the right.

**1. Adding a bookmark**

Clicking the add bookmark button opens a dialog where the user can enter a URL. The dialog will have a button to cancel and one to proceed. If the URL is already in the data store, it should tell the user and prevent creation. If the bookmark is added, it will be opened.

**2. Opening a bookmark**

Bookmarks open on the right. Here the user can edit the link's tags and note. The title is automatically fetched from the URL and taken from the document title.

**3. List of bookmarks**

Contains a list of all bookmarks sorted by ID in descending order. Each link will be shown along with its ID, title, tags and note

A bookmark in the list view can be clicked, which will open the bookmark.

**4. Searching bookmarks**

The user can search for bookmarks by using the search bar. The user can search by ID, title, tags, note and url. The search must be a fuzzy search. Results are shown in a list below ranked på relevance.

### Projects page

The project page looks similar to the bookmarks page with a list on the left, the opened project on the right and a searchbar and add button above.

Clicking the add button opens an empty project on the right. It is not saved yet, only when the user types something into the fields. In addition to the title and note fields, the user can add notes to the project by searching within the project view. A list will be shown similar to the bookmark list described previously.

The rest of the projects page is similar to the bookmarks page.

## Keyboard shortcuts

- `Ctrl+O` - Open JSON data file
- `Ctrl+S` - Save
- `Ctrl+Shift+S` - Save as
- `Ctrl+Q` - Close (ask if unsaved changes)

## Technical details

The note field is Markdown and should be edited using a small codemirror editor.

The ID is automatically assigned from the incrementing counter: `idCounter` in the data store. An ID will never be reused.

When a JSON data file is opened, it must be watched for file changes. If any changes are detected, reload the data file automatically. Only react to 'modify' or 'remove' events. Use the tauri fs watch function.

The app will store settings, such as the last opened data store in a config file at `~/.config/holger.ai/settings.json`. It must also be watched and reloaded when modify or remove events occur. If it is not present when the app starts, it must be created. When a data store file is opened, update the settings.json file accordingly.

Both projects and bookmarks can be edited any time they are open. Therefore an autosave feature must be implemented (1.5 seconds debounced), which will save the opened item.