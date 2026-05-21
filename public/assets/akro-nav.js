(function(){
  var nav = document.querySelector('.akro-nav');
  if(!nav) return;
  var burger = nav.querySelector('.akro-nav__burger');
  var menu = nav.querySelector('.akro-nav__menu');
  if(burger && menu){
    burger.addEventListener('click', function(){
      var open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function(e){
      if(e.target.tagName === 'A'){
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded','false');
      }
    });
  }
  var path = location.pathname.replace(/\/$/,'').replace(/\.html$/,'') || '/';
  nav.querySelectorAll('.akro-nav__menu a[href]').forEach(function(a){
    var href = a.getAttribute('href');
    if(!href || href.startsWith('#') || href.indexOf('://')>=0) return;
    var hrefPath = href.split('#')[0].replace(/\/$/,'') || '/';
    if(hrefPath === path) a.setAttribute('aria-current','page');
  });
})();
