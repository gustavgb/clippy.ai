# holger.ai

In this project I will be creating a local-first bookmarking/research tool with built in notetaking capabilities. It is called **holger.ai**.

## Tech stack

- Tauri V2
- Svelte
- Code Mirror 6

## Data Storage

Data will be stored in a JSON file on the user's file system. It will have the following interface:

```ts
interface Data {
  idCounter: number;
  collections: {
    id: number;
    title: string;
    note: string;
    links: number[];
    lastUpdated: string;
  }[];
  links: {
    id: number;
    title: string;
    note: string;
    tags: string[];
    lastUpdated: string;
  };
}
```

## Design

The user interface must be very simple. It will have a single page with a input field and add button on the top, used for creating a new bookmark. Below is a list of all links sorted by ID in descending order. Each link will be shown along with its ID, title, tags and note

When a link is added, it opens in a modal. Here the user can edit the link's tags and note. The title is automatically fetched from the URL and taken from the document title.

A link in the list view can be clicked, which will open the link in the same modal as I just described.

Here is a simple wireframe describing the layout:

```
---------------------------
|   url input      add    |
|      ------------       |
|      #3 Title           |
|      - tag1, tag2       |
|      notes              |
|      url (clickable)    |
|                         |
---------------------------
```

In addition there must be a quick search function similar to spotlight search, which is opened by clicking a button next to the add button, or by using a keyboard shortcut. When opened, the search bar replaces the input/add toolbar in the top. It can be closed by clicking a X button. Here the user can search by ID, title, tags, note and url. The search must be a fuzzy search. Results are shown in a list below ranked på relevance.

## Keyboard shortcuts

- `Ctrl+O` - Open JSON data file
- `Ctrl+S` - Save
- `Ctrl+Shift+S` - Save as
- `Ctrl+Q` - Close (ask if unsaved changes)
- `Ctrl+K` - Quick Search

## Technical details

The note field is Markdown and should be edited using a small codemirror editor.

The ID is automatically assigned from the incrementing counter: `idCounter` in the data store. An ID will never be reused.

When a JSON data file is opened, it must be watched for file changes. If any changes are detected, reload the data file automatically. Only react to 'modify' or 'remove' events. Use the tauri fs watch function.

The app will store settings, such as the last opened data store in a config file at `~/.config/holger.ai/settings.json`. It must also be watched and reloaded when modify or remove events occur. If it is not present when the app starts, it must be created. When a data store file is opened, update the settings.json file accordingly.
