const express = require('express');
const router = express.Router();

const TIPS = [
  {
    slug: 'to-tam', ico: '🧵',
    title: 'Hướng dẫn cách giặt và bảo quản trang phục bằng tơ tằm',
    lead: 'Tơ tằm rất mềm mại nhưng cũng dễ hỏng nếu giặt sai cách. Vài lưu ý nhỏ sau giúp áo lụa bền màu và giữ độ óng mượt.',
    sections: [
      { h: 'Khi giặt', items: [
        'Ưu tiên giặt tay bằng nước mát, tránh nước nóng.',
        'Dùng xà phòng hoặc nước giặt trung tính, không dùng thuốc tẩy.',
        'Ngâm không quá 5 phút, nhẹ tay vò, không xoắn hay vắt mạnh.',
        'Giặt riêng đồ lụa, tách khỏi quần áo khác màu.' ] },
      { h: 'Khi phơi và ủi', items: [
        'Phơi nơi thoáng mát, tránh nắng gắt vì dễ ố vàng và giòn sợi.',
        'Ủi ở nhiệt độ thấp, ủi mặt trái hoặc lót một lớp vải mỏng.' ] },
      { h: 'Bảo quản', items: [
        'Treo bằng móc rộng bản, để nơi khô ráo.',
        'Đặt gói hút ẩm trong tủ để tránh ẩm mốc.' ] }
    ]
  },
  {
    slug: 'thuoc-tay', ico: '🧴',
    title: 'Cách sử dụng thuốc tẩy cho quần áo vừa an toàn, vừa hiệu quả',
    lead: 'Thuốc tẩy giúp áo trắng sáng hơn và xử lý vết ố, nhưng dùng sai có thể làm mục vải và phai màu.',
    sections: [
      { h: 'Chọn đúng loại', items: [
        'Đồ trắng bằng cotton: có thể dùng thuốc tẩy gốc clo, pha loãng đúng hướng dẫn.',
        'Đồ màu, đồ mỏng: ưu tiên thuốc tẩy gốc oxy, nhẹ hơn.',
        'Không dùng cho lụa, len hoặc vải có nhãn "không tẩy".' ] },
      { h: 'Dùng an toàn', items: [
        'Luôn pha loãng trước khi cho quần áo vào, không đổ trực tiếp lên vải.',
        'Thử trước ở một góc khuất để kiểm tra phai màu.',
        'Tuyệt đối không trộn với chất tẩy rửa khác vì có thể sinh khí độc.',
        'Đeo găng tay, mở cửa thoáng khí và xả thật sạch sau khi tẩy.' ] }
    ]
  },
  {
    slug: 'do-da-moc', ico: '🧥',
    title: 'Mẹo phục hồi đồ da bị mốc đơn giản',
    lead: 'Áo da, túi da để lâu trong tủ ẩm rất dễ lên mốc. Xử lý sớm sẽ tránh làm hỏng bề mặt da.',
    sections: [
      { h: 'Các bước xử lý', items: [
        'Đem ra nơi thoáng, dùng khăn khô mềm lau lớp mốc bên ngoài.',
        'Pha nước và giấm trắng theo tỉ lệ 1:1, thấm khăn vắt gần khô rồi lau nhẹ.',
        'Để khô tự nhiên nơi thoáng gió, không phơi dưới nắng gắt hoặc dùng máy sấy.',
        'Thoa kem hoặc sáp dưỡng da để da mềm trở lại.' ] },
      { h: 'Phòng mốc về sau', items: [
        'Cất đồ da ở nơi khô ráo, có gói hút ẩm.',
        'Không bọc kín bằng túi nilon, nên dùng túi vải thoáng.',
        'Lấy ra hong gió định kỳ khoảng 1–2 tháng một lần.' ] }
    ]
  },
  {
    slug: 'ao-trang', ico: '👕',
    title: 'Tip đánh bay các vết bẩn trên áo trắng đơn giản tại nhà',
    lead: 'Vết bẩn càng xử lý sớm càng dễ sạch. Tùy loại vết mà cách xử lý sẽ khác nhau.',
    sections: [
      { h: 'Vết bẩn thường gặp', items: [
        'Vết mới dính: giặt ngay bằng nước lạnh, đừng để khô.',
        'Vết ố vàng ở cổ và nách: thoa hỗn hợp baking soda với ít nước, để 30 phút rồi giặt.',
        'Vết dầu mỡ: rắc bột hoặc thoa nước rửa chén, để một lúc rồi chà nhẹ.' ] },
      { h: 'Vết bẩn cứng đầu', items: [
        'Ngâm với bột tẩy gốc oxy theo hướng dẫn trên bao bì.',
        'Không dùng nước nóng ngay với vết máu hoặc thực phẩm, vì dễ làm vết bám chặt hơn.',
        'Với vết lâu ngày hoặc áo đắt tiền, nên mang đến tiệm để xử lý đúng kỹ thuật.' ] }
    ]
  }
];

router.get('/', (req, res) => res.redirect('/tips/' + TIPS[0].slug));

router.get('/:slug', (req, res) => {
  const tip = TIPS.find(t => t.slug === req.params.slug);
  if (!tip) return res.status(404).send('Không tìm thấy bài viết');
  res.render('tips/detail', {
    title: tip.title,
    tip,
    others: TIPS.filter(t => t.slug !== tip.slug)
  });
});

module.exports = router;
module.exports.TIPS = TIPS; // để trợ lý AI tham khảo các mẹo giặt của tiệm