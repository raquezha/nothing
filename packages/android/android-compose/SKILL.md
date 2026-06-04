---
name: android-compose
description: Tools and patterns for building Jetpack Compose UIs. Use for generating Composables, refactoring UI code, and implementing Material 3 designs.
---

# Android Compose Skill

Guidance and snippets for Jetpack Compose.

## Best Practices

- Use `remember` and `rememberSaveable` for state.
- Prefer `LazyColumn` for long lists.
- Use Material 3 components and `Theme`.

## Common Snippets

### Basic Composable
```kotlin
@Composable
fun MyComponent(name: String, modifier: Modifier = Modifier) {
    Text(text = "Hello $name!", modifier = modifier)
}
```

### Preview
```kotlin
@Preview(showBackground = true)
@Composable
fun MyComponentPreview() {
    MyTheme {
        MyComponent("Android")
    }
}
```

## UI Refactoring
The agent can help migrate XML layouts to Compose. Provide the XML file and ask the agent to rewrite it as a Composable.
