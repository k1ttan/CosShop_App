
INSERT INTO public.costumes (
  id, name, series, character, description,
  status, rent_price_per_day, deposit_price,
  quantity, buffer_days, late_fee_multiplier,
  weight_kg, image_urls, tags
) VALUES
(
  gen_random_uuid(),
  'Raiden Shogun - Lôi Thần Ei (Full Set + Vũ Khí Trấn)',
  'Genshin Impact',
  'Raiden Shogun',
  'Set trang phục cao cấp thiết kế gấm dệt chỉ vàng, bao gồm trang phục, giáp vai kim loại, wig tạo kiểu chuẩn anime và vũ khí Đoạn Thảo Trường Đao (Engulfing Lightning) phát sáng.',
  'available',
  180000, 600000, 2, 1, 1.5, 2.2,
  ARRAY[
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['HOT', 'Best Seller', 'Full Set', 'Size M']
),
(
  gen_random_uuid(),
  'Frieren - Pháp Sư Ngàn Tuổi (Áo Choàng + Gậy Phép Thuật)',
  'Sousou no Frieren',
  'Frieren',
  'Trang phục pháp sư Frieren chất liệu dạ tuyết cao cấp, kèm tai elf silicon y tế, tóc giả hai chùm bạch kim mềm mượt và trượng phép thuật dài 1m4 tháo lắp tiện lợi.',
  'available',
  140000, 450000, 1, 1, 1.5, 1.8,
  ARRAY[
    'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['MỚI', 'Trending', 'Phổ biến', 'Size S-M']
),
(
  gen_random_uuid(),
  'Acheron - Hoàng Tuyền (Váy Dạ Chiến + Trường Kiếm Thệ Ước)',
  'Honkai: Star Rail',
  'Acheron',
  'Set cosplay siêu phẩm Honkai Star Rail chi tiết thêu vi tính sắc sảo, tà áo bất đối xứng, găng tay da lộn, bốt cao cổ và thanh Nodachi dài 1m6 cực ngầu.',
  'available',
  200000, 700000, 1, 2, 1.8, 2.8,
  ARRAY[
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['VIP', 'Cực phẩm', 'Size M-L']
),
(
  gen_random_uuid(),
  'Kamado Nezuko - Quỷ Muội (Kimono Hồng + Ống Tre + Wig Siêu Dài)',
  'Kimetsu no Yaiba',
  'Nezuko Kamado',
  'Kimono hồng họa tiết asanoha truyền thống, obi kẻ caro đen trắng, haori đen lót lụa, ống tre ngậm chất liệu resin an toàn và tóc giả ombre cam tự nhiên.',
  'available',
  120000, 350000, 3, 1, 1.5, 1.5,
  ARRAY[
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Dễ mặc', 'Fes Favorite', 'Free size']
),
(
  gen_random_uuid(),
  'Hatsune Miku - Ca Sĩ Ảo Quốc Dân (Bản Original 16th Anniversary)',
  'Vocaloid',
  'Hatsune Miku',
  'Set Miku bản kỷ niệm phối màu bạc kim loại hologram tương lai, cà vạt xanh ngọc, tay áo rời có led viền phát sáng, tóc giả twin-tail xanh ngọc dài 1m2.',
  'available',
  160000, 500000, 2, 1, 1.5, 1.6,
  ARRAY[
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Biểu diễn', 'Hologram', 'Size S']
),
(
  gen_random_uuid(),
  'Gojo Satoru - Chú Thuật Sư Mạnh Nhất (Đồng Phục Cao Chuyên + Bịt Mắt)',
  'Jujutsu Kaisen',
  'Gojo Satoru',
  'Áo khoác form rộng cổ cao chuẩn dáng mẫu, quần âu ống suông, bịt mắt da mềm thoáng khí kèm kính đen mát, tóc giả bạc vuốt form tự nhiên.',
  'available',
  130000, 400000, 2, 1, 1.5, 1.4,
  ARRAY[
    'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Nam', 'Cool ngầu', 'Size L-XL']
),
(
  gen_random_uuid(),
  'Yor Forger - Điệp Viên Sát Thủ (Váy Đỏ + Vương Miện Gai)',
  'Spy x Family',
  'Yor Forger',
  'Bộ váy đỏ sang trọng phong cách ám sát viên, vương miện gai bạc, long vũ đen mềm, và đôi bốt da cao cổ cực ấn tượng phù hợp chụp ảnh sự kiện.',
  'available',
  150000, 480000, 1, 1, 1.5, 1.9,
  ARRAY[
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['MỚI', 'Nữ', 'Size S-M']
),
(
  gen_random_uuid(),
  'Zero Two - Darling (Bộ đồ Hiro-Squad + Sừng Cứng)',
  'Darling in the FranXX',
  'Zero Two',
  'Bộ đồng phục phi công squad 13 màu đỏ trắng, sừng đỏ chụp đầu nhẹ nhàng, wig hồng dài lưng cực nổi bật tại mọi sự kiện cosplay.',
  'available',
  145000, 430000, 1, 1, 1.5, 1.7,
  ARRAY[
    'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&auto=format&fit=crop&q=80'
  ],
  ARRAY['Biểu tượng', 'Nữ', 'Size M']
);

-- Hướng dẫn sử dụng:
-- 1. Vào Supabase Dashboard > SQL Editor
-- 2. Paste toàn bộ nội dung file này
-- 3. Click "Run" để seed data
-- 4. Kiểm tra bảng costumes có data chưa trong Table Editor
