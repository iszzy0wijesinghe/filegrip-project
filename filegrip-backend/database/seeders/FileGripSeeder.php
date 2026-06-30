<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class FileGripSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        /*
        |--------------------------------------------------------------------------
        | Plans
        |--------------------------------------------------------------------------
        */

        DB::table('plans')->updateOrInsert(
            ['slug' => 'free'],
            [
                'name' => 'Free',
                'price_monthly' => 0.00,
                'price_yearly' => 0.00,
                'currency' => 'USD',
                'max_file_size_mb' => 25,
                'max_files_per_job' => 5,
                'daily_job_limit' => 10,
                'monthly_job_limit' => 300,
                'batch_limit' => 1,
                'storage_limit_mb' => 0,
                'priority_level' => 1,
                'can_store_files' => false,
                'can_use_batch' => false,
                'can_use_api' => false,
                'has_ads' => true,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        DB::table('plans')->updateOrInsert(
            ['slug' => 'pro'],
            [
                'name' => 'Pro',
                'price_monthly' => 7.00,
                'price_yearly' => 70.00,
                'currency' => 'USD',
                'max_file_size_mb' => 250,
                'max_files_per_job' => 50,
                'daily_job_limit' => 200,
                'monthly_job_limit' => 5000,
                'batch_limit' => 25,
                'storage_limit_mb' => 1024,
                'priority_level' => 5,
                'can_store_files' => true,
                'can_use_batch' => true,
                'can_use_api' => false,
                'has_ads' => false,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        DB::table('plans')->updateOrInsert(
            ['slug' => 'business'],
            [
                'name' => 'Business',
                'price_monthly' => 19.00,
                'price_yearly' => 190.00,
                'currency' => 'USD',
                'max_file_size_mb' => 1000,
                'max_files_per_job' => 200,
                'daily_job_limit' => 1000,
                'monthly_job_limit' => 30000,
                'batch_limit' => 100,
                'storage_limit_mb' => 10240,
                'priority_level' => 10,
                'can_store_files' => true,
                'can_use_batch' => true,
                'can_use_api' => true,
                'has_ads' => false,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | Tool Categories
        |--------------------------------------------------------------------------
        */

        $categories = [
            [
                'name' => 'PDF Tools',
                'slug' => 'pdf-tools',
                'description' => 'Merge, split, compress, protect, and manage PDF files.',
                'icon' => 'file-text',
                'sort_order' => 1,
            ],
            [
                'name' => 'Convert Tools',
                'slug' => 'convert-tools',
                'description' => 'Convert documents, images, and PDFs between popular formats.',
                'icon' => 'refresh-cw',
                'sort_order' => 2,
            ],
            [
                'name' => 'Image Tools',
                'slug' => 'image-tools',
                'description' => 'Compress, convert, and prepare images for documents.',
                'icon' => 'image',
                'sort_order' => 3,
            ],
            [
                'name' => 'Security Tools',
                'slug' => 'security-tools',
                'description' => 'Protect, lock, and safely handle sensitive files.',
                'icon' => 'shield',
                'sort_order' => 4,
            ],
            [
                'name' => 'Edit Tools',
                'slug' => 'edit-tools',
                'description' => 'Edit, organize, and improve documents online.',
                'icon' => 'edit',
                'sort_order' => 5,
            ],
        ];

        foreach ($categories as $category) {
            DB::table('tool_categories')->updateOrInsert(
                ['slug' => $category['slug']],
                [
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'icon' => $category['icon'],
                    'sort_order' => $category['sort_order'],
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $categoryIds = DB::table('tool_categories')
            ->pluck('id', 'slug')
            ->toArray();

        /*
        |--------------------------------------------------------------------------
        | MVP Tools
        |--------------------------------------------------------------------------
        */

        $tools = [
            [
                'category_slug' => 'pdf-tools',
                'name' => 'Merge PDF',
                'slug' => 'merge-pdf',
                'short_description' => 'Combine multiple PDF files into one.',
                'description' => 'Merge PDF files online with fast, private processing and automatic file deletion.',
                'input_types' => ['pdf'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 20,
                'max_file_size_mb' => 25,
                'sort_order' => 1,
                'seo_title' => 'Merge PDF Online Free | FileGrip',
                'seo_description' => 'Merge PDF files online for free with FileGrip. Fast, private, and easy PDF merging.',
            ],
            [
                'category_slug' => 'pdf-tools',
                'name' => 'Split PDF',
                'slug' => 'split-pdf',
                'short_description' => 'Split PDF pages into separate files.',
                'description' => 'Split large PDF files into smaller documents or extract selected pages.',
                'input_types' => ['pdf'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 1,
                'max_file_size_mb' => 25,
                'sort_order' => 2,
                'seo_title' => 'Split PDF Online Free | FileGrip',
                'seo_description' => 'Split PDF files online for free. Extract pages quickly and securely with FileGrip.',
            ],
            [
                'category_slug' => 'pdf-tools',
                'name' => 'Compress PDF',
                'slug' => 'compress-pdf',
                'short_description' => 'Reduce PDF file size.',
                'description' => 'Compress PDF files while keeping quality suitable for sharing and uploading.',
                'input_types' => ['pdf'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 1,
                'max_file_size_mb' => 60,
                'sort_order' => 3,
                'seo_title' => 'Compress PDF Online Free | FileGrip',
                'seo_description' => 'Compress PDF files online with FileGrip. Reduce PDF size quickly and securely.',
            ],
            [
                'category_slug' => 'pdf-tools',
                'name' => 'Rotate PDF',
                'slug' => 'rotate-pdf',
                'short_description' => 'Rotate PDF pages easily.',
                'description' => 'Rotate all pages or selected pages in your PDF document.',
                'input_types' => ['pdf'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 1,
                'max_file_size_mb' => 25,
                'sort_order' => 4,
                'seo_title' => 'Rotate PDF Online Free | FileGrip',
                'seo_description' => 'Rotate PDF pages online for free. Fast and private PDF rotation with FileGrip.',
            ],
            [
                'category_slug' => 'edit-tools',
                'name' => 'Delete PDF Pages',
                'slug' => 'delete-pdf-pages',
                'short_description' => 'Remove unwanted PDF pages.',
                'description' => 'Delete selected pages from a PDF and download the cleaned file.',
                'input_types' => ['pdf'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 1,
                'max_file_size_mb' => 25,
                'sort_order' => 5,
                'seo_title' => 'Delete PDF Pages Online Free | FileGrip',
                'seo_description' => 'Remove unwanted PDF pages online with FileGrip. Simple, fast, and secure.',
            ],
            [
                'category_slug' => 'edit-tools',
                'name' => 'Reorder PDF Pages',
                'slug' => 'reorder-pdf-pages',
                'short_description' => 'Rearrange PDF pages.',
                'description' => 'Drag and reorder pages in your PDF document.',
                'input_types' => ['pdf'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 1,
                'max_file_size_mb' => 25,
                'sort_order' => 6,
                'seo_title' => 'Reorder PDF Pages Online | FileGrip',
                'seo_description' => 'Rearrange PDF pages online with FileGrip. Fast, smooth, and private.',
            ],
            [
                'category_slug' => 'security-tools',
                'name' => 'Protect PDF',
                'slug' => 'protect-pdf',
                'short_description' => 'Add password protection to PDFs.',
                'description' => 'Protect your PDF with a password before sharing or storing it.',
                'input_types' => ['pdf'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 1,
                'max_file_size_mb' => 25,
                'sort_order' => 7,
                'seo_title' => 'Protect PDF with Password | FileGrip',
                'seo_description' => 'Add password protection to PDF files online with FileGrip.',
            ],
            [
                'category_slug' => 'convert-tools',
                'name' => 'PDF to JPG',
                'slug' => 'pdf-to-jpg',
                'short_description' => 'Convert PDF pages to JPG images.',
                'description' => 'Turn each PDF page into a high-quality JPG image.',
                'input_types' => ['pdf'],
                'output_types' => ['jpg'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 1,
                'max_file_size_mb' => 25,
                'sort_order' => 8,
                'seo_title' => 'PDF to JPG Converter Online | FileGrip',
                'seo_description' => 'Convert PDF to JPG images online with FileGrip. Fast and private PDF conversion.',
            ],
            [
                'category_slug' => 'convert-tools',
                'name' => 'JPG to PDF',
                'slug' => 'jpg-to-pdf',
                'short_description' => 'Convert JPG images into PDF.',
                'description' => 'Create a PDF document from one or more JPG images.',
                'input_types' => ['jpg', 'jpeg'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 20,
                'max_file_size_mb' => 25,
                'sort_order' => 9,
                'seo_title' => 'JPG to PDF Converter Online | FileGrip',
                'seo_description' => 'Convert JPG images to PDF online for free with FileGrip.',
            ],
            [
                'category_slug' => 'convert-tools',
                'name' => 'PNG to PDF',
                'slug' => 'png-to-pdf',
                'short_description' => 'Convert PNG images into PDF.',
                'description' => 'Create a PDF document from one or more PNG images.',
                'input_types' => ['png'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 20,
                'max_file_size_mb' => 25,
                'sort_order' => 10,
                'seo_title' => 'PNG to PDF Converter Online | FileGrip',
                'seo_description' => 'Convert PNG images to PDF online for free with FileGrip.',
            ],
            [
                'category_slug' => 'convert-tools',
                'name' => 'Word to PDF',
                'slug' => 'word-to-pdf',
                'short_description' => 'Convert Word documents to PDF.',
                'description' => 'Convert DOC and DOCX files into PDF documents.',
                'input_types' => ['doc', 'docx'],
                'output_types' => ['pdf'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 1,
                'max_file_size_mb' => 25,
                'sort_order' => 11,
                'seo_title' => 'Word to PDF Converter Online | FileGrip',
                'seo_description' => 'Convert Word documents to PDF online with FileGrip.',
            ],
            [
                'category_slug' => 'convert-tools',
                'name' => 'PDF to Word',
                'slug' => 'pdf-to-word',
                'short_description' => 'Convert PDF files to Word.',
                'description' => 'Convert PDF documents into editable Word files.',
                'input_types' => ['pdf'],
                'output_types' => ['docx'],
                'is_premium' => true,
                'requires_login' => false,
                'max_file_count' => 1,
                'max_file_size_mb' => 25,
                'sort_order' => 12,
                'seo_title' => 'PDF to Word Converter Online | FileGrip',
                'seo_description' => 'Convert PDF to Word online with FileGrip. Fast and private document conversion.',
            ],
            [
                'category_slug' => 'image-tools',
                'name' => 'Compress Image',
                'slug' => 'compress-image',
                'short_description' => 'Reduce image file size.',
                'description' => 'Compress JPG, PNG, and WebP images for sharing and uploading.',
                'input_types' => ['jpg', 'jpeg', 'png', 'webp'],
                'output_types' => ['jpg', 'png', 'webp'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 20,
                'max_file_size_mb' => 25,
                'sort_order' => 13,
                'seo_title' => 'Compress Image Online | FileGrip',
                'seo_description' => 'Compress images online with FileGrip. Reduce JPG, PNG, and WebP file sizes.',
            ],
            [
                'category_slug' => 'image-tools',
                'name' => 'Convert Image',
                'slug' => 'convert-image',
                'short_description' => 'Convert image formats.',
                'description' => 'Convert images between JPG, PNG, and WebP formats.',
                'input_types' => ['jpg', 'jpeg', 'png', 'webp'],
                'output_types' => ['jpg', 'png', 'webp'],
                'is_premium' => false,
                'requires_login' => false,
                'max_file_count' => 20,
                'max_file_size_mb' => 25,
                'sort_order' => 14,
                'seo_title' => 'Image Converter Online | FileGrip',
                'seo_description' => 'Convert JPG, PNG, and WebP images online with FileGrip.',
            ],
        ];

        foreach ($tools as $tool) {
            DB::table('tools')->updateOrInsert(
                ['slug' => $tool['slug']],
                [
                    'category_id' => $categoryIds[$tool['category_slug']] ?? null,
                    'name' => $tool['name'],
                    'description' => $tool['description'],
                    'short_description' => $tool['short_description'],
                    'input_types' => json_encode($tool['input_types']),
                    'output_types' => json_encode($tool['output_types']),
                    'is_active' => true,
                    'is_premium' => $tool['is_premium'],
                    'requires_login' => $tool['requires_login'],
                    'max_file_count' => $tool['max_file_count'],
                    'max_file_size_mb' => $tool['max_file_size_mb'],
                    'sort_order' => $tool['sort_order'],
                    'seo_title' => $tool['seo_title'],
                    'seo_description' => $tool['seo_description'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }
}