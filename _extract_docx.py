#!/usr/bin/env python3
"""Temporary script to extract text from .docx files."""
import zipfile
import xml.etree.ElementTree as ET
import sys

def extract_docx(path):
    with zipfile.ZipFile(path) as z:
        with z.open('word/document.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
            for p in root.iter(f'{{{ns}}}p'):
                texts = []
                for t in p.iter(f'{{{ns}}}t'):
                    if t.text:
                        texts.append(t.text)
                line = ''.join(texts)
                if line.strip():
                    print(line)

if __name__ == '__main__':
    extract_docx(sys.argv[1])
