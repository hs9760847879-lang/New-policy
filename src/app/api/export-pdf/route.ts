import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface ExtractedPolicy {
  name: string;
  found: boolean;
  summary: string;
  details: string;
  conditions?: string[];
  refoundText?: string;
}

interface ExtractionResult {
  cancellationPolicies: ExtractedPolicy[];
  paymentPolicies: ExtractedPolicy[];
  generalTerms?: string;
  companyName?: string;
  lastUpdated?: string;
  modelUsed: string;
  attempts: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { result, url, scrapedInfo } = body as {
      result: ExtractionResult;
      url: string;
      scrapedInfo?: { title: string; contentLength: number; pagesScraped: number };
    };

    if (!result) {
      return NextResponse.json({ error: 'No result provided' }, { status: 400 });
    }

    // Create Python script for PDF generation
    const pythonScript = `
import sys
import json
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Read input data
input_data = json.loads(sys.argv[1])
result = input_data['result']
url = input_data['url']
scraped_info = input_data.get('scrapedInfo', {})

# Register fonts
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

# Create PDF
output_path = '/home/z/my-project/download/policy_report.pdf'
doc = SimpleDocTemplate(output_path, pagesize=A4,
    title='Policy Extraction Report',
    author='Z.ai',
    creator='Z.ai',
    subject='Student Accommodation Policy Analysis Report')

styles = getSampleStyleSheet()

# Custom styles
title_style = ParagraphStyle(
    'CustomTitle',
    fontName='Times New Roman',
    fontSize=24,
    textColor=colors.HexColor('#1F4E79'),
    alignment=TA_CENTER,
    spaceAfter=12
)

heading_style = ParagraphStyle(
    'CustomHeading',
    fontName='Times New Roman',
    fontSize=16,
    textColor=colors.HexColor('#1F4E79'),
    alignment=TA_LEFT,
    spaceAfter=12,
    spaceBefore=18
)

subheading_style = ParagraphStyle(
    'CustomSubheading',
    fontName='Times New Roman',
    fontSize=12,
    textColor=colors.HexColor('#333333'),
    alignment=TA_LEFT,
    spaceAfter=6
)

body_style = ParagraphStyle(
    'CustomBody',
    fontName='Times New Roman',
    fontSize=10,
    textColor=colors.black,
    alignment=TA_LEFT,
    spaceAfter=6
)

story = []

# Title
story.append(Paragraph('Policy Extraction Report', title_style))
story.append(Spacer(1, 6))

# Company info
story.append(Paragraph(f"Company: {result.get('companyName', 'Unknown')}", subheading_style))
story.append(Paragraph(f"Source URL: {url}", subheading_style))
story.append(Paragraph(f"Model Used: {result.get('modelUsed', 'N/A')}", subheading_style))
story.append(Paragraph(f"Extraction Date: {json.dumps(None, default=str) or 'N/A'}", subheading_style))
story.append(Spacer(1, 24))

# Summary
found_cancellation = len([p for p in result['cancellationPolicies'] if p.get('found')])
found_payment = len([p for p in result['paymentPolicies'] if p.get('found')])
story.append(Paragraph(f"Cancellation Policies Found: {found_cancellation}/13", subheading_style))
story.append(Paragraph(f"Payment Policies Found: {found_payment}/8", subheading_style))
story.append(Spacer(1, 24))

# Cancellation Policies Section
story.append(Paragraph('Cancellation Policies', heading_style))
story.append(Spacer(1, 12))

for policy in result['cancellationPolicies']:
    status = "Found" if policy.get('found') else "Not Found"
    story.append(Paragraph(f"<b>{policy['name']}</b> - {status}", subheading_style))
    
    if policy.get('found'):
        if policy.get('summary'):
            story.append(Paragraph(f"Summary: {policy['summary']}", body_style))
        if policy.get('details'):
            story.append(Paragraph(f"Details: {policy['details']}", body_style))
        if policy.get('conditions'):
            story.append(Paragraph(f"Conditions: {', '.join(policy['conditions'])}", body_style))
    story.append(Spacer(1, 12))

# Payment Policies Section
story.append(Paragraph('Payment Policies', heading_style))
story.append(Spacer(1, 12))

for policy in result['paymentPolicies']:
    status = "Found" if policy.get('found') else "Not Found"
    story.append(Paragraph(f"<b>{policy['name']}</b> - {status}", subheading_style))
    
    if policy.get('found'):
        if policy.get('summary'):
            story.append(Paragraph(f"Summary: {policy['summary']}", body_style))
        if policy.get('details'):
            story.append(Paragraph(f"Details: {policy['details']}", body_style))
        if policy.get('conditions'):
            story.append(Paragraph(f"Conditions: {', '.join(policy['conditions'])}", body_style))
    story.append(Spacer(1, 12))

# General Terms
if result.get('generalTerms'):
    story.append(Paragraph('General Terms', heading_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph(result['generalTerms'], body_style))

doc.build(story)
print(output_path)
`;

    // Write Python script to temp file
    const scriptPath = '/tmp/generate_pdf.py';
    fs.writeFileSync(scriptPath, pythonScript);

    // Execute Python script
    const inputData = JSON.stringify({ result, url, scrapedInfo });
    
    const pdfResult = await new Promise<string>((resolve, reject) => {
      const process = spawn('python3', [scriptPath, inputData]);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });
    });

    // Read the generated PDF
    const pdfPath = '/home/z/my-project/download/policy_report.pdf';
    const pdfBuffer = fs.readFileSync(pdfPath);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="policy_report.pdf"',
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
