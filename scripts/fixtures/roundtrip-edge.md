---
title: Edge cases
tags:
  - alpha
  - beta
---

# Headings

Setext H1
=========

Setext H2
---------

### H3 with `code`

#### H4

##### H5

###### H6

## Lists

- item one
- item two
  - nested a
  - nested b
    1. deep ordered
    2. another

* star bullet
+ plus bullet

1. first
2. second
3. third

5. starts at five
6. six

- [ ] open task
- [x] done task
  - nested task child

## Inline

**bold** __bold2__ *italic* _italic2_ ~~strike~~ `code` [text](https://example.com "title") ![alt](img.png "img title")

Autolink: <https://example.com>

Hard break at end of this line  
next line.

## Blocks

> quote line one
> quote line two
>
> > nested quote

    indented code block
    second line

```python
def hello(name):
    return f"hi {name}"
```

~~~
tilde fence
~~~

---

***

___

## Table

| Left | Center | Right |
| :--- | :----: | ----: |
| a | b | c |
| `code` | **bold** | [link](https://example.com) |

## Math

Inline $a+b$ and $c^2$.

$$
\int_0^1 x^2 dx
$$

## Footnote

Text with a footnote[^note] and another[^long].

[^note]: Simple footnote.

[^long]: Multi-line footnote.

    With an indented second paragraph.

## Escapes and entities

\*not italic\* &amp; &lt;tag&gt; 5 < 6 & 7 > 6

## Page break

Before.

<div style="page-break-after: always;"></div>

After.
