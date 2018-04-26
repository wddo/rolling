/**
 * <rolling>
 * 
 * @author : Jo Yun Ki (wddo@hanatour.com)
 * @version : 4.0.5
 * @since : 2013.10.22
 *
 * @classdesc
 * 
 * <strong>History</strong>
 * 
 * <pre class="prettyprint">
 * 1.0   (2013.10.22) : -
 * 4.0.0 (2017.04.25) : next(), prev(), dot() 내부 로직 moving()으로 통합
 * 4.0.1 (2017.06.22) : 외부에서 jump 속성 초기화 이후 변경가능 하도록 ins.setJump(value) 함수 추가
 * 4.0.2 (2017.08.14) : opts.lateClone 추가
 * 4.0.3 (2017.08.28) : lazy 스크롤 이벤트 중복에 따른 이벤트 off() 방지를 위해 lazyDefaultOptions() 에 중복안되는 명으로 event 옵션 추가
 * 4.0.4 (2017.09.21) : dotA 에 태그형태가 아닌상태에서 dynamicDot:true 상황에서 initDotA() 에서 $dotA undefined 문제 해결, $dotA.is('a, button') 로 'button' 추가
 * 4.0.5 (2018.03.19) : searchInstance() 적용
 * </pre>
 *
 * <strong>Note</strong>
 * 
 * <pre class="prettyprint">
 * 1. 내부함수 resetItem() 에서 jQuery 속성 .selector 을 사용하기 때문에 selector는 $('') 형태보다 String을 권장하며 $('') 형태일때 find() 만을 이용하여 셀렉트 합니다.
 *    반복문 안에서 $(this).find(..) 안되면 상황이면 $('대상:eq(' + idx + ')') 로 사용 권장
 * 2. range 보다 jump 가 큰 경우는 없을 것입니다.
 * 3. repeat 와 상관없이 jump 보다 range 크면 dotA 클릭 시 보여지는 아이템 자연스럽지 못하여 clone() 이용하여 dotA 복제
 * 4. itemTotal % jump 가 0이 아니고 repeat: false 경우 dotA 는 의미가 없어진다. 그러므로 모두 숨김
 * 5. dot 컨트롤러를 이용한 이동 시 jump 무시 될 수 있습니다.
 * 6. dynamicDot: true 시 container 아래 생성되며 <부모><자식></자식></부모> 쌍으로 넣으면 자식이 반복하여 생성, 부모없이 하나의 태그이면 무명의 div로 wrapping 됩니다.
 * </pre>
 * 
 * <strong>Initialize</strong>
 * 
 * <pre class="prettyprint">
 * var instance = new Hanatour.controls.rolling();
 * instance.init(options);
 * </pre>
 *
 * @tutorial [Demo]{@tutorial Hanatour.controls.rolling}
 * @module Hanatour/controls/rolling
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(['libs/jquery.lazyload'], factory) :
    (global.WToggle = factory());
}(this, function () {
    'use strict';
    var $ = Hanatour.jquery || jQuery;

    var wddoObj = function () {
        var scope,
            $container,
            $itemContainer,
            $item,
            $defaultItem,
            $cloneItem,
            $fadeItem,
            $activateItem,
            $controller,
            $prevA,
            $nextA,
            $dotA,
            $dotHtml,
            opts,
            defaults = defaultOptions(), //기본값
            lazyOpts,
            lazyDefaults = lazyDefaultOptions(), //lazy 기본값
            isPlay,
            distance,
            itemTotal,
            posNum = 0,
            currentIdx = 0,
            limit,
            direct = 'next',
            timerId;

        function defaultOptions() {
            return {
                range: 1,
                jump: 1,
                delay: 5000,
                speed: 800,
                ease: undefined,
                effect: 'slide',
                position: 'static',
                play: false,
                direction: 'horizontal',
                repeat: false,
                fit: false,
                wait: false,
                btnDisabledClass: undefined,
                dynamicDot: true,
                onClass: 'on',
                autoCSS: false,
                lateClone: false,
                autoArrowView: true,
                mouseEvent: true,
                touchEvent: true,
                lazy: false,
                onInit: undefined,
                onChange: undefined,
                onComplete: undefined
            };
        }

        function lazyDefaultOptions() {
            return {
                event : 'scroll.lazy_rolling_' + (Math.random().toFixed(16).substr(-5) + new Date().valueOf()), //add 4.0.3
                threshold: 0    
            };
        }

        //init
        function init() {
            if (opts.dotA === undefined) opts.dotA = $($.fn); //opts.dotA 에 대한 기본값
            if (opts.controller === undefined) opts.controller = $($.fn);

            $container = (typeof opts.container === 'string') ? $(opts.container) : opts.container;
            $itemContainer = (typeof opts.itemContainer === 'string') ? $(opts.itemContainer) : opts.itemContainer;
            $item = (typeof opts.item === 'string') ? $(opts.item) : opts.item;
            $defaultItem = (!opts.lateClone) ? $item : undefined; //modify.. add opts.lateClone 4.0.2
            $controller = (typeof opts.controller === 'string') ? $(opts.controller) : opts.controller;
            $prevA = (typeof opts.prevA === 'string') ? $(opts.prevA) : opts.prevA;
            $nextA = (typeof opts.nextA === 'string') ? $(opts.nextA) : opts.nextA;
            $dotA = (typeof opts.dotA === 'string' && (opts.dotA.indexOf('<') !== 0/* && !opts.dynamicDot*/)) ? $(opts.dotA) : opts.dotA; //del 4.0.4.. opts.dynamicDot
            isPlay = opts.play;
            distance = (opts.fit && opts.direction === 'horizontal') ? $item.outerWidth() : opts.distance / opts.jump;
            itemTotal = $item.length;
            limit = (!opts.repeat) ? 'first' : undefined;
            opts.jump = Math.min(opts.range, opts.jump); //jump는 range 보다 클 수 없다.

            //scope
            if ($container.data('scope') === undefined) $container.data('scope', scope);

            initDotA(); //dotA의 갯수 컨트롤(추가는 관여하지 않으나 jump 에 따라 숨김)
            initLayout(); //기본 레이아웃
            addEvent();
        
            hideAtag(); //포커스에 의해 레이아웃 어그러짐 방지를 위해 A 태그 숨김
            initLazy(); //lazy 적용

            //item에 고유넘버 'idx' 지정
            $item.each(function (idx) { $(this).data('idx', idx); });
            //dot에 고유넘버 'dix' 지정
            $dotA.each(function (idx) { $(this).data('idx', idx); });

            if (isPlay) startTimer();   //자동 플레이라면 타이머 시작

            saveActivate(); //활성화 저장

            changeDot(); //dot 변경
            changeArrowBtn(); //arrow 변경

            //외부 확장 함수 호출
            if (opts.onInit !== undefined) opts.onInit({opts: opts, idx: currentIdx, container: $container, activate: $activateItem, total: itemTotal, limit: limit, direct: direct});
        }

        //dotA 초기화
        function initDotA() {
            //태그형태로 넘어 왔을 경우 복제할 dotA 1개를 생성
            if (typeof opts.dotA === 'string' && opts.dotA.indexOf('<') === 0) {
                opts.dynamicDot = true;

                //<tag>형 opts.dotA 를 container 안에 마지막에 추가하고 $dotA 로 정의
                if ($dotHtml !== undefined && $dotHtml.length > 0) $dotHtml.remove(); //setReset() 시 다시 그리므로 이전 생성 삭제..
                $dotHtml = $(opts.dotA);
                $container.append($dotHtml);
                $dotA = $container.children().last();

                //<tag>형 opts.dotA 가 자식에 가지고 있으면 최하단 자식을 $dotA 지정
                while ($dotA.children().length > 0) {
                    $dotA = $dotA.children();
                }

                //최종 $dotA 가 a, button 태그이고 li나 span으로 감싸여져 있는 것이 아니라면 <div>로 강제로 감쌈
                if ($dotA.is('a, button') && !$dotA.parent().is('li, span')) $dotA.wrapAll('<div>');
            }

            //dotList에 $dotA 대한 index 가질수 있는 부모 이거나(li, span) 자신의 형제 정의
            var dotList = ($dotA.is('a, button') && $dotA.parent().is('li, span')) ? $dotA.parent() : $dotA;

            if (dotList === undefined) return; //dotA에 대한 지정 없으면 아래 로직 사용안함

            //실제 dotA에 대한 부모
            var dotContainer = dotList.parent();

            //자동생성 dotA (위에서 1개 생성한것을 소스로 사용 & html 박혀있는 1개를 사용)
            if (opts.dynamicDot && $dotA.length > 0) {
                var cloneDot = dotList.eq(0).clone(); //존재하는 1개 복제
                
                dotContainer.empty(); //전부비움

                //복제를 붙여넣음
                $item.each(function (idx) {
                    dotContainer.append(cloneDot);
                    cloneDot = dotContainer.children().filter(':last').clone();
                });

                //dotList 초기화
                dotList = dotContainer.children();
            }

            //리스트 개수가 jump 와 맞지 않고 반복이면 dotA 모두 숨김, repeat: false 는 dotA 노출 되지만 1:1 대응 못할 수 있음
            if (itemTotal % opts.jump !== 0 && opts.repeat) {
                dotList.remove();
                return;
            }

            //jump에 따른 dot의 갯수 삭제
            dotList.each(function (idx) {
                if (0 !== idx % opts.jump) $(this).hide();
            });

            //오버되는 dot 정리
            if (opts.range > opts.jump) {
                dotList.filter(function (idx) {
                    return (idx > itemTotal - ((opts.repeat) ? 1 : opts.range))
                }).remove();
            }

            //재 초기화
            dotList = dotContainer.children();

            //최종적으로 보여지는 dot 가 1개이하면 숨김
            if (dotList.length <= 1) dotList.hide();

            //$dotA 초기화
            //$dotA가 a, button 태그이고 부모가 li, span 인 경우(정상적인)
            if ($dotA.is('a, button') && $dotA.parent().is('li, span')) {
                //정적인 dotA 아니라면
                if (!opts.dynamicDot) {
                    //일반적인 <tag> 형이 아닌 문자열 selector 이라면 $(opts.dotA), jQuery object 이면 opts.dotA
                    $dotA = (typeof opts.dotA === 'string' && opts.dotA.indexOf('<') !== 0) ? $(opts.dotA) : opts.dotA;
                } else {
                    $dotA = dotList.children();
                }
            } else {
            // li, span 형태가 최종자식이면
                $dotA = dotList;
            }
        }

        //기본 레이아웃 조정
        function initLayout() {
            if (opts.autoCSS && $item.length > 0) $container.css('overflow', 'hidden');

            resetWidth();

            //range 보다 item 작거나 같으면 컨트롤러 숨김
            if ($controller.length > 0) $controller.toggle(itemTotal > opts.range);
        }

        //clone() 아이템을 위한 가로 재정의
        function resetWidth() {
            if (!opts.fit && opts.autoCSS) {
                //item 갯수 만큼 itemContainer width 늘림
                $itemContainer.css('width', $itemContainer.children().length * distance);    
            }
        }

        //이벤트
        function addEvent() {            
            //이전 화살표 클릭이벤트
            if ($prevA !== undefined) {
                $prevA.off('.rolling').on('click.rolling', function (e) {
                    e.preventDefault();
                    
                    if (opts.btnDisabledClass !== undefined && $prevA.hasClass(opts.btnDisabledClass)) return; //play:true로 이동 시 repeat 하고 next, prev 버튼 시엔 이동을 막을 경우를 위해 prev() 함수에서 빼냄
                    if (limit === 'first') return; //이미 first 이면 더이상 진행 막음

                    prev();
                });
            }
          
            //다음 화살표 클릭이벤트
            if ($nextA !== undefined) {
                $nextA.off('.rolling').on('click.rolling', function (e) {
                    e.preventDefault();

                    if (opts.btnDisabledClass !== undefined && $nextA.hasClass(opts.btnDisabledClass)) return; //play:true로 이동 시 repeat 하고 next, prev 버튼 시엔 이동을 막을 경우를 위해 prev() 함수에서 빼냄
                    if (limit === 'last') return; //이미 last 이면 더이상 진행 막음

                    next();
                });
            }
                        
            //도트 버튼 버튼이벤트
            if ($dotA !== undefined) {
                $dotA.off('.rolling').on('click.rolling', function (e) {
                    var target = $(e.currentTarget),
                        id = target.data('idx');

                    dot(id);

                    e.preventDefault();
                });
            }

            $container.off('.rolling');

            if (opts.mouseEvent) {
                //컨테이너 마우스 이벤트
                $container.on('mouseenter.rolling focusin.rolling', function (e) {
                    if (isPlay) stopTimer();
                });
                
                $container.on('mouseleave.rolling focusout.rolling', function (e) {
                    if (isPlay) startTimer();
                });    
            }
            
            //리사이징
            $(window).off('.rolling').on('resize.rolling', function (e) {
                /*
                if (opts.fit && opts.direction === 'horizontal' && opts.range === 1 && opts.jump === 1) {
                    distance = $item.outerWidth() * opts.jump;
                    
                    fixPos(0);
                }
                */
            });
            
            //터치이벤트
            if (opts.touchEvent) {
                var touchPos, touchStartPos, touchMovePos;
                $itemContainer.on('touchstart.rolling', function (e) {
                    if (event.touches.length === 1) touchStartPos = event.touches[0].screenX;
                });
                
                $itemContainer.on('touchmove.rolling', function (e) {
                    if (event.touches.length === 1) touchMovePos = event.touches[0].screenX;
                });
                
                $itemContainer.on('touchend.rolling', function (e) {
                    touchPos = touchMovePos - touchStartPos;
                    
                    if (isNaN(touchPos)) return;
                    
                    if (touchPos > 0) {
                        prev();
                    } else if (touchPos < 0) {
                        next();
                    }

                    touchStartPos = undefined;
                    touchMovePos = undefined;
                });
            }
        }

        //이전
        function prev(spd) {
            direct = 'prev';
            moving(getIndex(), spd);
        }

        //다음
        function next(spd) {
            direct = 'next';
            moving(getIndex(), spd);
        }

        //도트
        function dot(idx, spd) {
            direct = (currentIdx > idx) ? 'prev' : 'next'; //이동 방향 결정
            moving(idx, spd);
        }

        //dot, prev, next 에서 실행하는 실제 이동함수
        function moving(idx, spd) {
            if (opts.wait && $itemContainer.filter(':animated').length > 0) return;
            if (opts.wait && opts.effect === 'fade' && $item.filter(':animated').length > 0) return;
            if (itemTotal <= opts.range) return;
            if (idx === currentIdx) return; // 활성화 클릭 방지

            if ($itemContainer.filter(':animated').length > 0) motionComplete(); //연속 호출 시 어그러짐으로 선행

            checkLimit(idx); //limit 설정

            fadeOut(spd); //위치 변경전 $item 으로 페이드 아웃 

            clearClone(); //복제된 아이템 삭제

            switchItem(idx); //currentIdx 필요하므로 currentIdx 결정전에 호출 //내부에서 posNum 변경됨

            currentIdx = idx;

            if (direct === 'prev') {
                fixPos(-distance * posNum); //왼쪽으로 밀고

                motion(0, spd); //오른쪽으로 모션
            } else if (direct === 'next') {
                fixPos(0);  //0에 위치 시키고

                motion(-distance * posNum, spd); //왼쪽으로 모션
            }

            fadeIn(spd); //위치 변경후 $item 으로 페이드 인

            saveActivate(); //활성화 저장

            changeDot(); //dot 변경
            changeArrowBtn(); //arrow 변경

            //외부 확장 함수 호출
            if (opts.onChange !== undefined) opts.onChange({opts: opts, idx: currentIdx, container: $container, activate: $activateItem, total: itemTotal, limit: limit, direct: direct});
        }

        //prev(), next() 시 변화전인 currentIdx 가지고 상황에 맞게 idx, posNum 결정하여 반환하는 함수
        function getIndex() {
            var idx;

            if (direct === 'prev') {
                if (opts.repeat) {
                    idx = currentIdx - opts.jump < 0 ? itemTotal - Math.abs(currentIdx - opts.jump) : currentIdx - opts.jump; //가고자 하는 idx 가 0보다 작으면 총갯수에서 역으로 빼어 idx 추출
                } else {
                    var go = currentIdx - opts.jump; //목표치
                    var min = 0; //이동 가능한 마지막 인덱스

                    idx = (go < min) ? min : go;
                }
            } else if (direct === 'next') {
                if (opts.repeat) {
                    idx = currentIdx + opts.jump > itemTotal - 1 ? (currentIdx + opts.jump) - itemTotal : currentIdx + opts.jump
                } else {
                    var go = currentIdx + opts.jump; //목표치
                    var max = itemTotal - opts.range; //이동 가능한 마지막 인덱스

                    idx = (go > max) ? max : go;
                }
            }

            return idx;
        }

        //모션없이 한번에 이동
        function fixPos(pos) {
            var dir = getCSSDirection();

            $itemContainer.css(dir, pos + 'px');
        }

        //아이템 리스트 리셋
        function resetItem() {
            //.children(), .eq() 같은 메소드 지원하지 않으니 selector 문자열이 아니라 면 find()만 지원함
            $item = (typeof opts.item === 'string') ? $(opts.item) : $(opts.item.context).find(opts.item.selector);

            itemTotal = $item.length - (($cloneItem !== undefined) ? $cloneItem.length : 0);
        }
        
        //dot() 에서 아이템 복제 교환
        function switchItem(goIdx) {
            var chooseItem;
            var copyItem1, copyItem2;

            //add 4.0.2
            if (opts.lateClone && $defaultItem === undefined) {
                resetItem();
                $item.find('script').remove();
                $defaultItem = $item;
            }

            if (direct === 'prev') {
                posNum = Math.max(opts.jump, Math.min(currentIdx - goIdx, opts.range)); //이동 간격 저장, opts.jump 보다 작지 않도록(상황 : 처음에서 이전 실행 시)
                chooseItem = $item.eq(0);
     
                copyItem1 = $defaultItem.slice(0, itemTotal).clone(); 
                copyItem2 = $defaultItem.slice(0, currentIdx).clone();

                $cloneItem = $.merge(copyItem1, copyItem2); //1~12, 1~current
                $cloneItem = $cloneItem.slice(goIdx, goIdx + posNum); //이동시 필요한 최소 갯수만큼 준비 시킴 

                chooseItem.before($cloneItem); //원하는 아이템으로 현재 아이템 이전에 위치시킴
            } else if (direct === 'next') {
                posNum = Math.max(opts.jump, Math.min(goIdx - currentIdx, opts.range)); //이동 간격 저장, opts.jump 보다 작지 않도록(상황 : 끝에서 다음 실행 시)
                chooseItem = $item.eq(posNum);

                copyItem1 = $defaultItem.slice(goIdx, itemTotal).clone();
                copyItem2 = $defaultItem.slice(0, goIdx).clone();

                $cloneItem = $.merge(copyItem1, copyItem2); //go~12, 1~go
                $cloneItem = $cloneItem.slice(0, opts.range);  //이동시 필요한 최대 갯수만큼 준비 시킴 

                chooseItem.before($cloneItem); //원하는 아이템으로 현재 아이템 다음에 위치시킴
            }

            //복사 확인 테스트
            //if ($cloneItem !== undefined) $cloneItem.css('background-color', 'red');
            resetItem();
        }

        //모션이 일어난 후 아이템 순서대로 재정렬 (9,10,1,2,3,4,5,6,7,8)
        function alignItem() {
            //dot 에서 clone() 에 의해 추가된 아이템 삭제
            clearClone();

            $itemContainer.append($defaultItem.slice(currentIdx, itemTotal));
            $itemContainer.append($defaultItem.slice(0, currentIdx));
            fixPos(0);

            resetItem();
        }

        function clearClone() {
            if ($cloneItem !== undefined) {
                $cloneItem.remove();
                $cloneItem = undefined;
            }
        }

        //한계 체크(repeat 이 true 인 경우만 적용)
        function checkLimit(idx) {
            if (!opts.repeat) {
                if (idx >= itemTotal - opts.range && direct === 'next') {
                    //다음 버튼으로 이동 시
                    limit = 'last';
                } else if (idx === 0 && direct === 'prev') {
                    //이전 버튼으로 이동 시 
                    limit = 'first';
                } else {
                    limit = undefined;
                }
            }
        }

        //모션
        function motion(pos, spd) {
            var sp = (spd !== undefined) ? spd : opts.speed;
            sp = (opts.effect === 'fade') ? 0 : sp;
            
            showAtag();
            resetWidth();

            if (opts.direction === 'horizontal') {
                $itemContainer.stop().animate( {'marginLeft': pos + "px"},
                                        {queue:false, duration:sp, easing: opts.ease, complete:motionComplete}
                );  
            } else {
                $itemContainer.stop().animate( {'marginTop': pos + "px"},
                                        {queue:false, duration:sp, easing: opts.ease, complete:motionComplete}
                );
            }
        }

        //페이드 아웃 (사라지는 아이템 복사해서 위치 영향안받게 absolute 적용 후 투명도 0 모션 
        function fadeOut(spd) {
            var sp = (spd !== undefined) ? spd : opts.speed;

            if (opts.effect === 'fade') {
                //fadeComplete 에서 실행하던 초기화
                fadeResetItem($item.filter(':animated'));
                fadeRemoveItem();

                $fadeItem = $item.slice(0, opts.range).clone();

                $fadeItem.filter(function (idx) {
                    fadeFloatItem($fadeItem, idx, 1); //정렬형태로 변경 

                    return true;
                }).animate({
                    'opacity' : 0
                }, {queue: false, duration: sp});
            }
        }

        //페이드 인 (등장 하는 아이템, 기존 slide 아이템에 투명도만 조정)
        function fadeIn(spd) {
            var sp = (spd !== undefined) ? spd : opts.speed;

            if (opts.effect === 'fade') {
                var target = $item.slice(0, opts.range);

                target.filter(function (idx) {
                    fadeFloatItem(target, idx, 0); //정렬형태로 변경 

                    return true;
                }).animate({
                    'opacity' : 1
                }, {queue: false, duration: sp, complete: function () {
                    if (target !== undefined) { //1회만
                        target = undefined;

                        fadeComplete();
                    }
                }});

                $itemContainer.append($fadeItem);
            }
        }

        //강제로 가로형태로
        function fadeFloatItem(target, idx, opacity) {
            target.clearQueue().stop().eq(idx).css({
                'position' : 'absolute',
                'left' : (idx * Math.abs(opts.distance / opts.jump)) + $item.position().left,
                'opacity' : opacity
            });
        }

        //페이드 초기로 css 돌려놓기
        function fadeResetItem(target) {
            target.clearQueue().stop().css({
                'position' : opts.position,
                'left' : '',
                'opacity' : ''
            });
        }

        //페이드인 미리 삭제
        function fadeRemoveItem() {
            if ($fadeItem !== undefined) { //1회만
                $fadeItem.clearQueue().stop().remove();
                $fadeItem = undefined;
            }
        }
        
        function motionComplete() {           
            alignItem();
            hideAtag();
            resetWidth();

            if (opts.effect !== 'fade') complete();
        }

        function fadeComplete() {
            fadeResetItem($item);    //아이템 초기화 (absolute -> static)
            fadeRemoveItem();           

            if (opts.effect === 'fade') complete();
        }

        function complete() {
            saveActivate();
            restartLazy(); //lazy 재로드

            if (opts.onComplete !== undefined) opts.onComplete({opts: opts, idx: currentIdx, container: $container, activate: $activateItem, total: itemTotal, limit: limit, direct: direct});
        }

        //방향에 따른 컨트롤할 CSS 반환            
        function getCSSDirection() {
            return (opts.direction === 'horizontal') ? 'marginLeft' : 'marginTop';
        }
        
        //타이머
        function startTimer() {
            stopTimer();
            timerId = setInterval(timerFun, opts.delay);
        }

        function stopTimer() {
            if (timerId !== undefined) {
                clearInterval(timerId);
                timerId = undefined;
            }
        }

        function timerFun() {
            if (direct === 'prev') {
                prev();
            } else if (direct === 'next') {
                next();
            }
        }
        
        //활성화 아이템 저장
        function saveActivate() {
            if ($item !== undefined) $activateItem = $item.slice(0, opts.range);
        }

        //dot 변경
        function changeDot() {
            if ($dotA !== undefined) $dotA.removeClass(opts.onClass).eq(currentIdx).addClass(opts.onClass);
        }

        //arrow 변경, repeat 가 false 인 경우 첫 페이지 마지막 페이지 에서 화살표 숨김
        function changeArrowBtn() {
            if (opts.autoArrowView && !opts.repeat && $prevA !== undefined && $nextA !== undefined) {
                if ($prevA.length > 0 && $nextA.length > 0) {
                    var currentPage = (Math.floor(currentIdx / opts.range) + 1);
                    var totalPage = (Math.floor((itemTotal - 1) / opts.range) + 1);

                    $prevA.show();
                    $nextA.show();

                    if (currentIdx <= 0) $prevA.hide();
                    if (itemTotal - opts.range <= currentIdx) $nextA.hide();
                }
            }
        }

        //포커스에 의해 레이아웃 어그러짐 방지를 위해 range 밖 영역의 item A 태그 숨김
        function hideAtag() {
            if ($item !== undefined) $item.slice(opts.range, itemTotal)/*.find('a')*/.css('visibility', 'hidden');
        }

        //lazy 초기화
        function initLazy() { 
            if ($.fn.lazyload !== undefined && $item !== undefined && opts.lazy) {
                var lazyTarget = $item.find('.lazy');
                lazyTarget.lazyload(lazyOpts);
            }
        }

        //lazyload() 내부 $.rightoffold()에 의한 미로드 item들에 대하여.. //화면에 보여지면 로드되지 못한 lazy 재로드 신청
        function restartLazy() {
            if ($.fn.lazyload !== undefined && $activateItem !== undefined && opts.lazy) {
                $activateItem.find('img.lazy').filter(function () { //보여지는 아이템의 이미지 중
                    var url = $(this).attr('src');
                    return url !== undefined && url.indexOf('data:image') === 0; //로드되지 못한 섭네일만
                }).lazyload();
            }
        }
        
        //모션이 시작하면 숨겼던 아이템 A 태그 모두 노출
        function showAtag() {
            if ($item !== undefined) $item/*.find('a')*/.css('visibility', 'visible');
        }

        //삭제 여부 반환
        function getDispose() {
            return ($container === undefined);
        }

        return {
            /**
             * 초기화
             * @instance
             * 
             * @param {Object} options 옵션값
             * @property options
             * @property {String | jQueryObject}    options.container                   - 전체 영역 부모 jquery 셀렉터
             * @property {String | jQueryObject}    options.itemContainer               - 리스트를 감싸고 있는 부모 jquery 셀렉터
             * @property {String | jQueryObject}    options.item                        - 리스트들 jquery 셀렉터
             * @property {String | jQueryObject}    options.controller                  - 컨트로러 jquery 셀렉터
             * @property {String | jQueryObject}    options.prevA                       - 화살표 이전 jquery 셀렉터
             * @property {String | jQueryObject}    options.nextA                       - 화살표 다음 jquery 셀렉터
             * @property {String | jQueryObject}    options.dotA                        - 도트버튼 jquery 셀렉터 | html 태그
             * @property {Number}                   options.distance                    - 클릭시 이동할 거리
             * @property {Number}                   options.range=1                     - 노출될 리스트 갯수
             * @property {Number}                   options.jump=1                      - 한번에 이동 할 갯수
             * @property {Number}                   options.delay=5000                  - 자동롤링 시간
             * @property {Number}                   options.speed=800                   - 모션 속도
             * @property {Number}                   options.direction='horizontal'      - 방향 ['horizontal' | 'vertical']
             * @property {String}                   options.ease                        - 모션 이징값, ex) 'easeOutQuart'
             * @property {String}                   options.effect='slide'              - 이동효과 ['slide' | 'fade']
             * @property {String}                   options.position='static'           - fade 모션 완료 후 리스트 포지션css 값
             * @property {Boolean}                  options.play=false                  - 자동 롤링 유무
             * @property {Boolean}                  options.repeat=false                - 한 방향으로 무한 반복 유무
             * @property {Boolean}                  options.fit=false                   - 가로 폭이 유동적인지 유무
             * @property {Boolean}                  options.wait=false                  - 이동 중 이동 막을지 유무
             * @property {String}                   options.btnDisabledClass='noData'   - 버튼 진행을 막을 클래스
             * @property {Boolean}                  options.dynamicDot=true             - 도트 생성 할지 유무
             * @property {String}                   options.onClass='on'                - 도트 활성화 클래스
             * @property {Boolean}                  options.autoCSS=false               - 자동으로 itemContainer 의 width 와 container 의 overflow 조정
             * @property {Boolean}                  options.lateClone=false             - 늦은 복제 옵션, 첫 이동 시 item을 복제하고 내부 script태그 삭제
             * @property {Boolean}                  options.autoArrowView=true          - prevA, nextA 자동 처음,마지막 페이지에서 숨길지 유무
             * @property {Boolean}                  options.mouseEvent=true             - 마우스 오버&아웃 시 play 정지&재생 여부
             * @property {Boolean}                  options.touchEvent=true             - 터치 이벤트 유무
             * @property {Boolean}                  options.lazy=false                  - lazy 적용 유무
             * @property {Function}                 options.onInit                      - 초기화 콜백
             * @property {Function}                 options.onChange                    - 변경 콜백
             * @property {Function}                 options.onComplete                  - 변경 완료 콜백
             * 
             * @param {Object} lazyOptions lazy옵션값 (참조: <a href="https://appelsiini.net/projects/lazyload/v1/">https://appelsiini.net/projects/lazyload/v1/</a>)
             * @property lazyOptions
             * @property {String}                   lazyOptions.event='scroll.lazy_rolling_'+(난수)   - 스크롤 이벤트 네임스페이스
             * @property {Number}                   lazyOptions.threshold=0                           - lazy 반응위치 브라우저 하단아래로 몇 픽셀
             */
            init : function (options, lazyOptions) {
                opts = $.extend({}, defaults, options);
                lazyOpts = $.extend({}, lazyDefaults, lazyOptions);

                //중복 방지
                if ($.fn.setInstance !== undefined) {
                    if ($(opts.container).searchInstance('rolling') !== undefined) $(opts.container).searchInstance('rolling').dispose(); //add 4.0.5
                } else {
                    if ($(opts.container).length > 0 && $(opts.container).data('scope') !== undefined) $(opts.container).data('scope').dispose();
                }

                scope = this;

                init();
            },

            /**
             * 파괴
             * @instance
             */
            dispose : function () {
                if (getDispose()) return;

                if (opts.direction === 'horizontal') {
                    $itemContainer.stop().css({'marginLeft': 0 + "px"});
                } else {
                    $itemContainer.stop().css({'marginTop': 0 + "px"});
                }
                
                stopTimer();
                clearClone();

                $item.find('a').removeData('idx').css('visibility', '');
                $prevA.off('.rolling');
                $nextA.off('.rolling');
                $dotA.off('.rolling').removeData('idx');
                $container.off('.rolling').removeData('scope');
                $(window).off('.rolling');
                
                $container = undefined;
                $itemContainer = undefined;
                $item = undefined;
                $defaultItem = undefined;
                $controller = undefined;
                $prevA = undefined;
                $nextA = undefined;
                $dotA = undefined;
                $dotHtml = undefined;
                opts = undefined;
                defaults = defaultOptions();
                lazyOpts = undefined;
                lazyDefaults = lazyDefaultOptions();
                isPlay = undefined;
                distance = undefined;
                itemTotal = undefined;
                posNum = 0;
                currentIdx = 0;
                limit = undefined;
                direct = 'next';
                timerId = undefined;
            },

            /**
             * 새로고침. setRest() 포함하고 있으며 현재상태 유지용
             * @instance
             * @params idx - 해당 idx로 초기화
             */
            setRefresh : function (idx) {
                var startIdx = (idx === undefined) ? currentIdx : idx;
                scope.setChange(0, 0);
                scope.setReset();
                scope.setChange(startIdx, 0);
            },

            /**
             * 리셋. 새로그림
             * @instance
             */
            setReset : function () {
                if (getDispose()) return;

                //위치 0으로 초기화
                direct = (currentIdx > 0) ? 'prev' : 'next'; //이동 방향 결정

                posNum = opts.jump; //이동 간격 결정

                checkLimit(0); //limit 설정

                clearClone(); //복제된 아이템 삭제

                currentIdx = 0; //활성화 저장

                showAtag();

                resetItem();

                $defaultItem = (!opts.lateClone) ? $item : undefined; //modify.. add opts.lateClone 4.0.2

                fixPos(0); //모션 시작위치 강제 이동, 위치 0으로 초기화

                isPlay = opts.play;
                distance = (opts.fit && opts.direction === 'horizontal') ? $item.outerWidth() : opts.distance / opts.jump;
                itemTotal = $item.length;
                limit = (!opts.repeat) ? 'first' : undefined;
                opts.jump = Math.min(opts.range, opts.jump);
                
                initDotA();
                changeDot(); //dot 변경
                changeArrowBtn(); //arrow 변경
                initLayout();
                addEvent();

                hideAtag();
                initLazy(); //lazy 적용
                
                $item.each(function (idx) { $(this).data('idx', idx); });
                $dotA.each(function (idx) { $(this).data('idx', idx); });

                if (isPlay) startTimer();

                saveActivate(); //활성화 저장

                //연결된 함수 재호출
                if (opts.onInit !== undefined) opts.onInit({opts: opts, idx: currentIdx, container: $container, activate: $activateItem, total: itemTotal, limit: limit, direct: direct});
                if (opts.onChange !== undefined) opts.onChange({opts: opts, idx: currentIdx, container: $container, activate: $activateItem, total: itemTotal, limit: limit, direct: direct});
                if (opts.onComplete !== undefined) opts.onComplete({opts: opts, idx: currentIdx, container: $container, activate: $activateItem, total: itemTotal, limit: limit, direct: direct});
            },
        
            /**
             * 리스트 변경
             * @instance
             * @param {Number} idx 변경할 인덱스
             * @param {Number} spd 변경 속도. 미지정시 옵션 속도 
             */
            setChange : function (idx, spd) {
                if (getDispose()) return;

                if (!opts.repeat) idx = Math.min(Math.max(0, idx), itemTotal - opts.range);

                dot(idx, spd);
            },
            
            /**
             * 자동롤링 활성화
             * @instance
             */
            setPlay : function () {
                if (getDispose()) return;

                isPlay = true;
                startTimer();
            },

            /**
             * 자동롤링 비활성화
             * @instance
             */
            setStop : function () {
                if (getDispose()) return;

                isPlay = false;
                stopTimer();
            },

            /**
             * 다음으로 이동
             * @instance
             * @param {Number} spd 변경 속도. 미지정시 옵션 속도
             */
            setNext : function (spd) {
                if (getDispose()) return;

                if (opts.repeat) {
                    next(spd);
                } else {
                    direct = 'next';
                    dot(getIndex(), spd);
                }
            },

            /**
             * 이전으로 이동
             * @instance
             * @param {Number} spd 변경 속도. 미지정시 옵션 속도
             */
            setPrev : function (spd) {
                if (getDispose()) return;

                if (opts.repeat) {
                    prev(spd);
                } else {
                    direct = 'prev';
                    dot(getIndex(), spd);
                }
            },

            /**
             * 점프 옵션 변경
             * @instance
             * @param {Number} value 한번에 이동할 갯수
             */
            setJump : function (value) { //add 4.0.1
                opts.jump = Math.min(opts.range, value);
            },

            /**
             * 현재 인덱스 반환
             * @instance
             * @return {Number} 현재 인덱스 
             */
            getCurrent : function () {
                if (getDispose()) return;

                return currentIdx;
            },

            /**
             * 총 갯수 반환
             * @instance
             * @return {Number} 총 갯수
             */
            getTotal : function () {
                if (getDispose()) return;
                
                return itemTotal;
            },

            /**
             * 방향 반환
             * @instance
             * @return {String} 'horizontal' | 'vertical'
             */
            getDirect : function () {
                if (getDispose()) return;

                return direct;
            },

            package : this.package
        };
    };//end Obj

    wddoObj.prototype.package = 'Hanatour.controls.rolling';
    
    return wddoObj;
}));